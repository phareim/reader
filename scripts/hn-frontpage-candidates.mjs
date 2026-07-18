#!/usr/bin/env node
/**
 * Hacker News front-page Discover collector — domains that keep earning the
 * front page are usually blogs worth subscribing to at the source. Pulls the
 * last 30 days of ≥100-point stories from the free Algolia HN API (the
 * `front_page` tag only covers the CURRENT front page, so points are the
 * front-page proxy — and job posts, which carry no points, fall out for
 * free), counts distinct stories per domain, and POSTs domains with ≥3
 * appearances to Reader's Discover ingest seam (`POST
 * /api/discover/candidates`, source `hn-frontpage`); the crawl's
 * resolve/probe stages find the actual feed. Idempotent — re-sends are
 * no-ops server-side. Runs weekly via reader-hn-candidates.timer.
 *
 * Reads ~/.config/reader/env for READER_API_URL and READER_MCP_TOKEN.
 * Flags: --dry-run, --days N (default 30), --min-count N (default 3),
 *        --min-points N (default 100), --max N (default 20)
 */
import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const argv = process.argv.slice(2)
const dryRun = argv.includes('--dry-run')
const flag = (name, dflt) => {
  const i = argv.indexOf(name)
  return i !== -1 ? Number(argv[i + 1]) : dflt
}
const days = flag('--days', 30)
const minCount = flag('--min-count', 3)
const minPoints = flag('--min-points', 100)
const max = flag('--max', 20)

// Domains that recur on the HN front page but are platforms/institutions,
// not subscribable blogs (Reader-side PLATFORM_DOMAINS catches the rest).
const EXCLUDED = new Set([
  'github.com', 'youtube.com', 'twitter.com', 'x.com', 'reddit.com',
  'wikipedia.org', 'en.wikipedia.org', 'arxiv.org', 'news.ycombinator.com',
  'bloomberg.com', 'reuters.com', 'apnews.com', 'bbc.com', 'bbc.co.uk',
  'nytimes.com', 'wsj.com', 'ft.com', 'theguardian.com', 'washingtonpost.com',
  'cnbc.com', 'techcrunch.com', 'theverge.com', 'arstechnica.com',
  'medium.com', 'substack.com', 'archive.org', 'gist.github.com',
])

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
if (!token && !dryRun) {
  console.error('READER_MCP_TOKEN missing from ~/.config/reader/env')
  process.exit(1)
}

const since = Math.floor(Date.now() / 1000) - days * 86_400
const hits = []
for (let page = 0; page < 3; page++) {
  const res = await fetch(
    `https://hn.algolia.com/api/v1/search_by_date?tags=story&hitsPerPage=1000&page=${page}` +
      `&numericFilters=created_at_i%3E${since},points%3E${minPoints}`,
    { signal: AbortSignal.timeout(30_000) }
  )
  if (!res.ok) {
    console.error(`Algolia HN API failed: ${res.status}`)
    process.exit(1)
  }
  const data = await res.json()
  hits.push(...data.hits)
  if (page >= (data.nbPages ?? 1) - 1) break
}

const domains = new Map() // host -> { count, sampleTitle }
for (const hit of hits) {
  if (!hit.url) continue // Ask HN / Show HN text posts
  let host
  try {
    host = new URL(hit.url).hostname.toLowerCase().replace(/^www\./, '')
  } catch {
    continue
  }
  if (EXCLUDED.has(host)) continue
  const entry = domains.get(host) || { count: 0, sampleTitle: hit.title }
  entry.count += 1
  domains.set(host, entry)
}

const candidates = [...domains.entries()]
  .filter(([, d]) => d.count >= minCount)
  .sort((a, b) => b[1].count - a[1].count)
  .slice(0, max)
  .map(([host, d]) => ({ url: `https://${host}/`, title: null, _count: d.count }))

console.log(`${hits.length} ≥${minPoints}-point stories in ${days}d → ${candidates.length} domain(s) with ≥${minCount} appearances`)
for (const c of candidates) console.log(`  ${c._count}× ${c.url}`)

if (dryRun || !candidates.length) {
  if (dryRun) console.log('(dry run — nothing posted)')
  process.exit(0)
}

const post = await fetch(`${apiUrl}/api/discover/candidates`, {
  method: 'POST',
  headers: { 'X-MCP-Token': token, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    source: 'hn-frontpage',
    label: 'Hacker News front page',
    candidates: candidates.map(({ url, title }) => ({ url, title })),
  }),
  signal: AbortSignal.timeout(120_000),
})
if (!post.ok) {
  console.error(`discover ingest failed: ${post.status} ${await post.text().catch(() => '')}`)
  process.exit(1)
}
const result = await post.json()
console.log(`posted: +${result.added} candidate(s), +${result.edges} edge(s), ${result.skipped} skipped`)
