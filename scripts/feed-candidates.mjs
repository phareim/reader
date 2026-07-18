#!/usr/bin/env node
/**
 * Feed-candidate report: mine the SFL save stream and the thoughts wiki for
 * domains worth subscribing to, subtract current Reader subscriptions, and
 * probe the survivors for working RSS/Atom feeds.
 *
 * Signals (strongest first):
 *   - folded: the saved article became a source of a wiki article
 *     (~/thoughts/sync/provenance.json + raw frontmatter)
 *   - starred / saved: rows in the sleeper-articles DB (~/chat/articles)
 *
 * Runs on Sleeper only — reads local service data. Auth for the Reader API
 * comes from ~/.config/reader/env (READER_API_URL + READER_MCP_TOKEN).
 *
 * Unless --no-push is given, the shortlist is also POSTed to Reader's
 * Discover ingest seam (POST /api/discover/candidates, source `sfl-saves`)
 * so the candidates land on /discover next to the blogroll-graph finds —
 * idempotent server-side, and still never auto-subscribes.
 *
 * Usage: node scripts/feed-candidates.mjs [--json] [--min-score N] [--no-push]
 */

import { execFileSync } from 'node:child_process'
import { readFileSync, readdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const HOME = homedir()
const ARTICLES_DB = join(HOME, 'chat/articles/data/articles.db')
const PROVENANCE = join(HOME, 'thoughts/sync/provenance.json')
const RAW_DIR = join(HOME, 'thoughts/raw')
const ENV_FILE = join(HOME, '.config/reader/env')

const argv = process.argv.slice(2)
const asJson = argv.includes('--json')
const noPush = argv.includes('--no-push')
const minScore = Number(argv[argv.indexOf('--min-score') + 1]) || 4

// Domains that are aggregators/platforms, not subscribable publications
const PLATFORM_DOMAINS = new Set([
  'x.com', 'twitter.com', 'linkedin.com', 'news.ycombinator.com',
  'reddit.com', 'youtube.com', 'youtu.be', 'github.com', 'en.wikipedia.org'
])

const FEED_PATHS = [
  '/rss', '/rss.xml', '/feed', '/feed.xml', '/atom.xml', '/index.xml',
  '/feed/', '/news/rss.xml', '/blog/rss.xml'
]

const domainOf = (url) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return null
  }
}

const loadEnvFile = (path) => {
  const env = {}
  try {
    for (const line of readFileSync(path, 'utf8').split('\n')) {
      const m = line.match(/^([A-Z_]+)=(.*)$/)
      if (m) env[m[1]] = m[2]
    }
  } catch {
    /* missing file handled by caller */
  }
  return env
}

// --- 1. Current subscriptions ------------------------------------------------
const cfg = { ...loadEnvFile(ENV_FILE), ...process.env }
if (!cfg.READER_API_URL || !cfg.READER_MCP_TOKEN) {
  console.error(`Missing READER_API_URL / READER_MCP_TOKEN (checked ${ENV_FILE} and process env)`)
  process.exit(1)
}

const feedsRes = await fetch(`${cfg.READER_API_URL}/api/feeds`, {
  headers: { 'X-MCP-Token': cfg.READER_MCP_TOKEN }
})
if (!feedsRes.ok) {
  console.error(`GET /api/feeds failed: HTTP ${feedsRes.status}`)
  process.exit(1)
}
const { feeds } = await feedsRes.json()
const subscribed = new Set()
for (const f of feeds) {
  for (const u of [f.url, f.siteUrl ?? f.site_url]) {
    const d = u && domainOf(u)
    if (d) subscribed.add(d)
  }
}

// --- 2. Save stream from sleeper-articles ------------------------------------
const rows = execFileSync('sqlite3', ['-json', ARTICLES_DB,
  "SELECT url, starred FROM articles WHERE kind='article'"
], { encoding: 'utf8' })
const saves = JSON.parse(rows || '[]')

// --- 3. Folded-into-wiki signal ----------------------------------------------
const foldedIds = new Set()
try {
  const prov = JSON.parse(readFileSync(PROVENANCE, 'utf8'))
  for (const entries of Object.values(prov.by_slug ?? {})) {
    for (const e of entries) {
      const id = typeof e === 'string' ? e : e?.sfl_id
      if (id) foldedIds.add(String(id))
    }
  }
} catch {
  console.error(`warn: could not read ${PROVENANCE}; fold signal disabled`)
}

const foldedDomains = new Map()
for (const file of readdirSync(RAW_DIR).filter((f) => f.endsWith('.md'))) {
  let head
  try {
    head = readFileSync(join(RAW_DIR, file), 'utf8').slice(0, 2000)
  } catch {
    continue
  }
  const url = head.match(/^url:\s*"?([^"\n]+?)"?\s*$/m)?.[1]
  const sflId = head.match(/^sfl_id:\s*(\S+)/m)?.[1]
  const d = url && domainOf(url)
  if (d && sflId && foldedIds.has(sflId)) {
    foldedDomains.set(d, (foldedDomains.get(d) ?? 0) + 1)
  }
}

// --- 4. Score per domain ------------------------------------------------------
const stats = new Map()
for (const { url, starred } of saves) {
  const d = domainOf(url)
  if (!d) continue
  const s = stats.get(d) ?? { saves: 0, starred: 0, folds: 0 }
  s.saves += 1
  s.starred += starred ? 1 : 0
  stats.set(d, s)
}
for (const [d, folds] of foldedDomains) {
  const s = stats.get(d) ?? { saves: 0, starred: 0, folds: 0 }
  s.folds = folds
  stats.set(d, s)
}

const candidates = [...stats.entries()]
  .map(([domain, s]) => ({ domain, ...s, score: s.saves + 2 * s.starred + 3 * s.folds }))
  .filter((c) => c.score >= minScore)
  .filter((c) => !PLATFORM_DOMAINS.has(c.domain))
  .filter((c) => !subscribed.has(c.domain))
  .sort((a, b) => b.score - a.score)

// --- 5. Probe candidates for working feeds ------------------------------------
const fetchOk = async (url) => {
  try {
    const ctl = new AbortController()
    const t = setTimeout(() => ctl.abort(), 8000)
    const res = await fetch(url, {
      signal: ctl.signal,
      redirect: 'follow',
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; feed-candidates/1.0)' }
    })
    clearTimeout(t)
    if (!res.ok) return null
    return await res.text()
  } catch {
    return null
  }
}

const looksLikeFeed = (body) => /<(rss|feed)[\s>]/i.test(body?.slice(0, 2000) ?? '')

const discoverFeed = async (domain) => {
  const html = await fetchOk(`https://${domain}`)
  if (html) {
    const link = html.match(
      /<link[^>]+type="application\/(?:rss|atom)\+xml"[^>]*>/i
    )?.[0]
    const href = link?.match(/href="([^"]+)"/i)?.[1]
    if (href) {
      const url = new URL(href, `https://${domain}`).href
      const body = await fetchOk(url)
      if (looksLikeFeed(body)) return url
    }
  }
  for (const path of FEED_PATHS) {
    const url = `https://${domain}${path}`
    const body = await fetchOk(url)
    if (looksLikeFeed(body)) return url
  }
  return null
}

for (const c of candidates) {
  c.feedUrl = await discoverFeed(c.domain)
}

// --- 6. Report -----------------------------------------------------------------
if (asJson) {
  console.log(JSON.stringify({ generated_at: new Date().toISOString(), candidates }, null, 2))
} else {
  console.log(`# Feed candidates — ${new Date().toISOString().slice(0, 10)}\n`)
  console.log(`Analyzed ${saves.length} saved articles; ${subscribed.size} subscribed domains excluded.\n`)
  if (!candidates.length) {
    console.log('No new candidates above the score threshold.')
  }
  for (const c of candidates) {
    const feed = c.feedUrl ? `feed: ${c.feedUrl}` : 'no feed found'
    console.log(
      `- **${c.domain}** — score ${c.score} (${c.saves} saved, ${c.starred} starred, ${c.folds} folded to wiki) — ${feed}`
    )
  }
}

// --- 7. Push into Discover -----------------------------------------------------
// Only candidates with a working feed — /discover shows subscribable things.
const pushable = candidates.filter((c) => c.feedUrl)
if (!noPush && pushable.length) {
  const res = await fetch(`${cfg.READER_API_URL}/api/discover/candidates`, {
    method: 'POST',
    headers: { 'X-MCP-Token': cfg.READER_MCP_TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      source: 'sfl-saves',
      label: 'Your SFL saves',
      candidates: pushable.slice(0, 50).map((c) => ({
        url: `https://${c.domain}/`,
        feedUrl: c.feedUrl,
      })),
    }),
    signal: AbortSignal.timeout(60_000),
  })
  if (res.ok) {
    const result = await res.json()
    console.error(`\ndiscover: +${result.added} candidate(s), +${result.edges} edge(s), ${result.skipped} skipped`)
  } else {
    console.error(`\ndiscover push failed (${res.status}) — report above is unaffected`)
  }
}
