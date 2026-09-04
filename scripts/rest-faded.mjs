#!/usr/bin/env node
/**
 * Nightly rest for faded articles — calls the Worker's internal rest-faded
 * endpoint until it reports done (batches of 2000). Runs from a systemd user
 * timer on Sleeper (see scripts/systemd/reader-rest-faded.{service,timer}).
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

let total = 0
for (let round = 0; round < 50; round++) {
  const res = await fetch(`${apiUrl}/api/internal/rest-faded`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${cronKey}` },
    signal: AbortSignal.timeout(120_000),
  })
  if (!res.ok) {
    console.error(`rest-faded failed: ${res.status} ${await res.text().catch(() => '')}`)
    process.exit(1)
  }
  const { rested, done } = await res.json()
  total += rested
  if (done) break
}

console.log(`rested ${total} faded article(s)`)
