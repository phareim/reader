#!/usr/bin/env node
/**
 * Linked-sources sync trigger — calls the Worker's internal sync-sources
 * endpoint, which pages every linked account (X bookmarks, Reddit saved,
 * Hacker News favorites) into its user's Found feed (see
 * server/api/internal/sync-sources.post.ts). Runs from a systemd user
 * timer on Sleeper (scripts/systemd/reader-sources-sync.*), replacing the
 * per-source Sleeper-side collectors.
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

const res = await fetch(`${apiUrl}/api/internal/sync-sources`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${cronKey}` },
  signal: AbortSignal.timeout(180_000),
})

if (!res.ok) {
  console.error(`sync-sources failed: ${res.status} ${await res.text().catch(() => '')}`)
  process.exit(1)
}

const result = await res.json()
const errors = result.results.filter((r) => r.error)
console.log(
  `${result.sources} linked source(s), ${result.ingested} item(s) ingested` +
    (errors.length ? `, errors: ${JSON.stringify(errors)}` : '')
)
if (errors.length) process.exit(1)
