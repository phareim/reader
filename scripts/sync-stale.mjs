#!/usr/bin/env node
/**
 * Background feed sync trigger — calls the Worker's internal sync-stale
 * endpoint, which syncs a small batch of the stalest active feeds across
 * ALL users. Runs from a systemd user timer on Sleeper (see
 * scripts/systemd/reader-sync-stale.{service,timer}); freshness comes from
 * the timer cadence, not batch size (Worker subrequest cap).
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

const res = await fetch(`${apiUrl}/api/internal/sync-stale`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${cronKey}` },
  signal: AbortSignal.timeout(120_000),
})

if (!res.ok) {
  console.error(`sync-stale failed: ${res.status} ${await res.text().catch(() => '')}`)
  process.exit(1)
}

const result = await res.json()
console.log(
  `synced ${result.synced} feed(s), ${result.newArticles} new article(s)` +
    (result.failures.length ? `, failures: ${JSON.stringify(result.failures)}` : '')
)
