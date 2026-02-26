import dotenv from 'dotenv'
import path from 'node:path'
import fs from 'node:fs'
import os from 'node:os'
import { promisify } from 'node:util'
import { execFile } from 'node:child_process'

dotenv.config({ path: path.join(process.cwd(), '.env') })
dotenv.config({ path: path.join(process.cwd(), '.env.local') })

const execFileAsync = promisify(execFile)

const SAMPLE_SIZE = Number(process.env.R2_SAMPLE_SIZE || 10)
const DB_NAME = 'reader-service'
const BUCKET = 'reader-articles'

const run = async () => {
  const rows = await sampleArticleRows(SAMPLE_SIZE)
  console.log(`Checking ${rows.length} articles for R2 content...`)

  let missing = 0
  let skipped = 0

  for (const row of rows) {
    if (!row.content_key) {
      skipped += 1
      continue
    }

    const exists = await checkR2Object(row.content_key)
    if (!exists) {
      console.warn(`Missing R2 content: ${row.content_key} (article ${row.id})`)
      missing += 1
    }
  }

  if (missing === 0) {
    console.log(`R2 content spot-check passed. (Skipped ${skipped} rows without content_key)`) 
  } else {
    console.log(`R2 content spot-check failed: ${missing} missing objects. (Skipped ${skipped})`)
    process.exitCode = 1
  }
}

const sampleArticleRows = async (count: number) => {
  const result = await execFileAsync('npx', [
    'wrangler',
    'd1',
    'execute',
    DB_NAME,
    '--remote',
    '--command',
    `SELECT id, content_key FROM "Article" ORDER BY RANDOM() LIMIT ${count};`
  ])

  const match = result.stdout.match(/"results"\s*:\s*(\[[\s\S]*?\])\s*,\s*"success"/)
  if (!match) return []
  try {
    return JSON.parse(match[1]) as { id: number; content_key: string | null }[]
  } catch {
    return []
  }
}

const checkR2Object = async (key: string) => {
  const tmpFile = path.join(os.tmpdir(), `r2-check-${Date.now()}-${Math.random().toString(16).slice(2)}.txt`)
  try {
    await execFileAsync('npx', [
      'wrangler',
      'r2',
      'object',
      'get',
      `${BUCKET}/${key}`,
      `--file=${tmpFile}`
    ])
    return fs.existsSync(tmpFile)
  } catch {
    return false
  } finally {
    if (fs.existsSync(tmpFile)) {
      fs.unlinkSync(tmpFile)
    }
  }
}

run().catch((error) => {
  console.error('R2 content check failed:', error.message)
  process.exit(1)
})
