#!/usr/bin/env node
/**
 * ooh.directory Discover collector — Phil Gyford's hand-curated directory of
 * ~2,400 living blogs (every entry has a feed). Maps the user's feed tags to
 * directory categories via the hand-written map below, scrapes a few category
 * pages per run (round-robin cursor in state.json so all mapped categories are
 * covered over the weeks), and POSTs fresh blogs to Reader's Discover ingest
 * seam (`POST /api/discover/candidates`, source `ooh-directory`). Each new
 * blog's "More info" page is fetched for the exact RSS URL, so candidates
 * arrive with `feedUrl` and skip the Worker's expensive resolve stage.
 *
 * Polite by design: weekly cadence, first category page only, ≤ --max info
 * pages per run, a delay between fetches, and a seen-set in state.json so a
 * blog is never re-scraped once posted. The ingest seam is idempotent anyway.
 *
 * Reads ~/.config/reader/env for READER_API_URL and READER_MCP_TOKEN.
 * State at ~/.config/reader/ooh-state.json ({ cursor, seen: [hosts] }).
 * Flags: --dry-run, --verbose, --categories a/b,c/d (override the map),
 *        --per-run N (categories per run, default 3), --max N (new blogs
 *        per run, default 20), --max-age-days N (skip blogs quiet longer,
 *        default 365)
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, dirname } from 'node:path'

const argv = process.argv.slice(2)
const dryRun = argv.includes('--dry-run')
const verbose = argv.includes('--verbose')
const flag = (name, dflt) => {
  const i = argv.indexOf(name)
  return i !== -1 ? argv[i + 1] : dflt
}
const perRun = Number(flag('--per-run', 3))
const max = Number(flag('--max', 20))
const maxAgeDays = Number(flag('--max-age-days', 365))
const categoriesOverride = flag('--categories', null)

const BASE = 'https://ooh.directory'
const UA = 'reader-discover-bot (+https://reader.phareim.no)'
const FETCH_DELAY_MS = 400

// Reader feed-tag (lowercased) → ooh.directory category paths. Hand-written
// on purpose (see task DO-MOUSY-TRICKING-PREVALENT) — extend as tags appear.
const TAG_CATEGORIES = {
  ai: ['technology/ai'],
  tech: ['technology/development', 'technology/internet', 'technology'],
  comics: ['arts/illustration', 'arts/images'],
  culture: ['arts', 'society'],
  writers: ['arts/books', 'humanities/language'],
  'long-reads': ['personal', 'humanities/philosophy'],
  opinions: ['personal', 'society'],
  leadership: ['economics'],
  marketing: ['economics'],
  design: ['arts/design'],
  music: ['arts/music'],
  science: ['science'],
  history: ['humanities/history'],
}

function loadEnv(path) {
  const out = {}
  try {
    for (const line of readFileSync(path, 'utf8').split('\n')) {
      const m = line.match(/^([A-Z_]+)=(.*)$/)
      if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, '')
    }
  } catch {
    // missing file — fall through to the check below
  }
  return out
}

const env = loadEnv(join(homedir(), '.config', 'reader', 'env'))
const apiUrl = (env.READER_API_URL || 'https://reader.phareim.no').replace(/\/$/, '')
const token = env.READER_MCP_TOKEN
if (!token) {
  console.error('READER_MCP_TOKEN missing from ~/.config/reader/env')
  process.exit(1)
}

const statePath = join(homedir(), '.config', 'reader', 'ooh-state.json')
let state = { cursor: 0, seen: [] }
try {
  state = { ...state, ...JSON.parse(readFileSync(statePath, 'utf8')) }
} catch {
  // first run
}
const seen = new Set(state.seen)

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const decode = (s) =>
  s
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')

async function get(path) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'User-Agent': UA },
    signal: AbortSignal.timeout(20_000),
  })
  if (!res.ok) return null
  return res.text()
}

// ---- pick this run's categories --------------------------------------------

let categories
if (categoriesOverride) {
  categories = categoriesOverride.split(',').map((c) => c.trim().replace(/^\/|\/$/g, ''))
} else {
  const feedsRes = await fetch(`${apiUrl}/api/feeds`, {
    headers: { 'X-MCP-Token': token },
    signal: AbortSignal.timeout(30_000),
  })
  if (!feedsRes.ok) {
    console.error(`GET /api/feeds failed: ${feedsRes.status}`)
    process.exit(1)
  }
  const feeds = await feedsRes.json()
  const tags = new Set()
  for (const f of Array.isArray(feeds) ? feeds : feeds.feeds || []) {
    for (const t of f.tags || []) tags.add(String(t.name ?? t).toLowerCase())
  }
  const mapped = [...new Set([...tags].flatMap((t) => TAG_CATEGORIES[t] || []))].sort()
  if (!mapped.length) {
    console.log('No feed tags map to ooh.directory categories — nothing to do')
    process.exit(0)
  }
  const start = state.cursor % mapped.length
  categories = Array.from({ length: Math.min(perRun, mapped.length) }, (_, i) => mapped[(start + i) % mapped.length])
  state.cursor = (start + categories.length) % mapped.length
}
console.log(`categories this run: ${categories.join(', ')}`)

// ---- scrape category pages -------------------------------------------------

const cutoff = Date.now() - maxAgeDays * 86_400_000
const found = new Map() // host -> { url, title, infoId }

for (const cat of categories) {
  const html = await get(`/blogs/${cat}/`)
  await sleep(FETCH_DELAY_MS)
  if (!html) {
    console.error(`  ${cat}: fetch failed, skipping`)
    continue
  }
  const items = html.split('class="websites__item"').slice(1)
  let kept = 0
  for (const item of items) {
    const link = item.match(/<a href="(https?:\/\/[^"]+)"[^>]*>([^<]+)<\/a>/)
    if (!link) continue
    const info = item.match(/href="\/blog\/([a-z0-9]+)\/"/)
    const updated = item.match(/datetime="([^"]+)"/)
    if (updated && Date.parse(updated[1]) < cutoff) continue
    let host
    try {
      host = new URL(link[1]).hostname.toLowerCase().replace(/^www\./, '')
    } catch {
      continue
    }
    if (seen.has(host) || found.has(host)) continue
    found.set(host, { url: link[1], title: decode(link[2].trim()), infoId: info?.[1] || null })
    kept += 1
  }
  if (verbose) console.log(`  ${cat}: ${items.length} entries, ${kept} new`)
}

const fresh = [...found.entries()].slice(0, max)
console.log(`${found.size} unseen blog(s), taking ${fresh.length}`)

// ---- fetch feed URLs from the info pages -----------------------------------

const candidates = []
for (const [host, blog] of fresh) {
  let feedUrl = null
  if (blog.infoId) {
    const html = await get(`/blog/${blog.infoId}/`)
    await sleep(FETCH_DELAY_MS)
    const rss = html?.match(/<a[^>]*icon--rss[^>]*>/)?.[0].match(/href="([^"]+)"/)
    if (rss) feedUrl = decode(rss[1])
  }
  candidates.push({ url: blog.url, feedUrl, title: blog.title, _host: host })
  if (verbose) console.log(`  ${blog.title} — ${blog.url}${feedUrl ? ` (feed: ${feedUrl})` : ''}`)
}

if (dryRun || !candidates.length) {
  if (dryRun) console.log('(dry run — nothing posted, state untouched)')
  process.exit(0)
}

// ---- post to the ingest seam -----------------------------------------------

const post = await fetch(`${apiUrl}/api/discover/candidates`, {
  method: 'POST',
  headers: { 'X-MCP-Token': token, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    source: 'ooh-directory',
    label: 'ooh.directory',
    candidates: candidates.map(({ url, feedUrl, title }) => ({ url, feedUrl, title })),
  }),
  signal: AbortSignal.timeout(120_000),
})
if (!post.ok) {
  console.error(`discover ingest failed: ${post.status} ${await post.text().catch(() => '')}`)
  process.exit(1)
}
const result = await post.json()
console.log(`posted: +${result.added} candidate(s), +${result.edges} edge(s), ${result.skipped} skipped`)

for (const c of candidates) seen.add(c._host)
state.seen = [...seen]
mkdirSync(dirname(statePath), { recursive: true })
writeFileSync(statePath, JSON.stringify(state, null, 2))
