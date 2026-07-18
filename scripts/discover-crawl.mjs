#!/usr/bin/env node
/**
 * Discover blogroll-crawl trigger — calls the Worker's internal
 * discover-crawl endpoint, which visits a small batch of subscribed sites'
 * blogrolls (≥7-day per-site re-crawl floor), resolves site-only candidates
 * to feed URLs, and probes resolved ones. Runs from a systemd user timer on
 * Sleeper (see scripts/systemd/reader-discover-crawl.{service,timer});
 * coverage comes from the timer cadence, not batch size.
 *
 * The timeout is 300s (not sync-stale's 120s): the resolve stage runs
 * discoverFeeds(), whose page fetch honors FETCH_TIMEOUT (default 30s) per
 * candidate, so a slow batch legitimately takes minutes.
 *
 * Reads ~/.config/reader/env for READER_API_URL and READER_CRON_KEY.
 */
import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

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
const cronKey = env.READER_CRON_KEY

if (!cronKey) {
  console.error('READER_CRON_KEY missing from ~/.config/reader/env')
  process.exit(1)
}

const res = await fetch(`${apiUrl}/api/internal/discover-crawl`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${cronKey}` },
  signal: AbortSignal.timeout(300_000),
})

if (!res.ok) {
  console.error(`discover-crawl failed: ${res.status} ${await res.text().catch(() => '')}`)
  process.exit(1)
}

const result = await res.json()
console.log(
  `crawled ${result.sitesCrawled} site(s), ${result.blogrollsFound} blogroll(s), ` +
    `+${result.candidatesAdded} candidate(s), +${result.edgesAdded} edge(s), ` +
    `resolved ${result.resolved}, probed ${result.probed}` +
    (result.failures.length ? `, failures: ${JSON.stringify(result.failures)}` : '')
)
