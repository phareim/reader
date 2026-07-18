#!/usr/bin/env node
/**
 * Discover blogroll-crawl trigger — calls the Worker's internal
 * discover-crawl endpoint, which visits a small batch of subscribed sites'
 * blogrolls (≥7-day per-site re-crawl floor), resolves site-only candidates
 * to feed URLs, and probes resolved ones. Runs from a systemd user timer on
 * Sleeper (see scripts/systemd/reader-discover-crawl.{service,timer});
 * coverage comes from the timer cadence, not batch size.
 *
 * Each stage is POSTed as its OWN Worker invocation (the per-invocation
 * fetch budget is ~50 in practice — one combined run blows it), resolve
 * several times to drain the backlog blogroll finds create. The timeout is
 * 300s per call (not sync-stale's 120s): the resolve stage's page fetches
 * honor FETCH_TIMEOUT (default 30s) per candidate, so a slow batch
 * legitimately takes minutes.
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

async function runStage(stage) {
  const res = await fetch(`${apiUrl}/api/internal/discover-crawl`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${cronKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ stage }),
    signal: AbortSignal.timeout(300_000),
  })
  if (!res.ok) {
    console.error(`discover-crawl ${stage} failed: ${res.status} ${await res.text().catch(() => '')}`)
    process.exit(1)
  }
  return await res.json()
}

const total = {
  sitesCrawled: 0, blogrollsFound: 0, candidatesAdded: 0,
  edgesAdded: 0, resolved: 0, probed: 0, failures: [],
}
// One crawl, three resolve rounds (blogroll finds create a resolve backlog
// far faster than one round drains it), one probe round.
for (const stage of ['crawl', 'resolve', 'resolve', 'resolve', 'probe']) {
  const r = await runStage(stage)
  for (const key of Object.keys(total)) {
    if (key === 'failures') total.failures.push(...r.failures)
    else total[key] += r[key]
  }
}

console.log(
  `crawled ${total.sitesCrawled} site(s), ${total.blogrollsFound} blogroll(s), ` +
    `+${total.candidatesAdded} candidate(s), +${total.edgesAdded} edge(s), ` +
    `resolved ${total.resolved}, probed ${total.probed}` +
    (total.failures.length ? `, failures: ${JSON.stringify(total.failures)}` : '')
)
