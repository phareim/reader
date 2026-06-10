/**
 * One-shot backfill of Article.image_url for already-stored articles.
 *
 * For every article whose image_url is NULL, empty, or legacy Unsplash
 * filler, fetch the article page and pull the publisher's og:image /
 * twitter:image from the head (same selector order as
 * server/utils/extractContent.ts extractLeadImage — duplicated here because
 * this script runs under plain Node where the `linkedom/worker` entry the
 * server code imports does not resolve).
 *
 * Reads and writes the REMOTE D1 database via `npx wrangler d1 execute
 * --remote`, so run it from the repo root on a host where wrangler is
 * authenticated. Updates are guarded (only rows still image-less are
 * touched), so the script is idempotent and safe to re-run.
 *
 * Usage:
 *   node scripts/backfill-images.mjs           # dry run: fetch + report only
 *   node scripts/backfill-images.mjs --apply   # write updates to D1
 *   node scripts/backfill-images.mjs --apply --limit 100
 */
import { execFileSync } from 'node:child_process'
import { writeFileSync, rmSync } from 'node:fs'
import { parseHTML } from 'linkedom'

const APPLY = process.argv.includes('--apply')
const limitArg = process.argv.indexOf('--limit')
const LIMIT = limitArg !== -1 ? Number(process.argv[limitArg + 1]) : Infinity
const CONCURRENCY = 8
const FETCH_TIMEOUT_MS = 15000
const SQL_CHUNK = 200

const NEEDS_IMAGE = `(image_url IS NULL OR image_url = '' OR image_url LIKE '%.unsplash.com%')`

const LEAD_IMAGE_META_SELECTORS = [
  'meta[property="og:image:secure_url"]',
  'meta[property="og:image"]',
  'meta[name="og:image"]',
  'meta[name="twitter:image"]',
  'meta[property="twitter:image"]',
  'meta[name="twitter:image:src"]'
]

/**
 * Even with --json, wrangler prefixes the payload with progress lines
 * ("├ Checking if file needs uploading") in --file mode — strip everything
 * before the first line that opens the JSON array.
 */
function parseWranglerJson(out) {
  const lines = out.split('\n')
  const start = lines.findIndex((line) => line.trim().startsWith('['))
  if (start === -1) throw new Error(`No JSON in wrangler output:\n${out}`)
  return JSON.parse(lines.slice(start).join('\n'))
}

function d1(command) {
  const out = execFileSync(
    'npx',
    ['wrangler', 'd1', 'execute', 'reader-service', '--remote', '--json', '--command', command],
    { encoding: 'utf-8', maxBuffer: 64 * 1024 * 1024 }
  )
  return parseWranglerJson(out)[0]
}

function d1File(path) {
  const out = execFileSync(
    'npx',
    ['wrangler', 'd1', 'execute', 'reader-service', '--remote', '--json', '--file', path],
    { encoding: 'utf-8', maxBuffer: 64 * 1024 * 1024 }
  )
  return parseWranglerJson(out)
}

function leadImageFromHead(html, articleUrl) {
  try {
    const { document } = parseHTML(html)
    for (const selector of LEAD_IMAGE_META_SELECTORS) {
      const content = document.querySelector(selector)?.getAttribute('content')?.trim()
      if (!content) continue
      try {
        const url = new URL(content, articleUrl)
        if (url.protocol === 'http:' || url.protocol === 'https:') return url.href
      } catch {
        // keep looking
      }
    }
  } catch {
    // unparseable page
  }
  return null
}

async function fetchLeadImage(articleUrl) {
  const response = await fetch(articleUrl, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    redirect: 'follow',
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; TheLibrarian/1.0; RSS Reader)',
      Accept: 'text/html,application/xhtml+xml'
    }
  })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  const contentType = response.headers.get('content-type') || ''
  if (!contentType.includes('text/html') && !contentType.includes('application/xhtml')) {
    throw new Error(`Not HTML: ${contentType}`)
  }
  return leadImageFromHead(await response.text(), articleUrl)
}

const rows = d1(
  `SELECT id, url FROM "Article" WHERE ${NEEDS_IMAGE} ORDER BY id`
).results.slice(0, LIMIT)
console.log(`${rows.length} articles need an image${APPLY ? '' : ' (dry run — no writes)'}`)

const found = []
let fetchErrors = 0
let noImage = 0
let done = 0

async function worker(queue) {
  for (;;) {
    const row = queue.shift()
    if (!row) return
    try {
      const image = await fetchLeadImage(row.url)
      if (image) found.push({ id: row.id, image })
      else noImage++
    } catch {
      fetchErrors++
    }
    done++
    if (done % 100 === 0) {
      console.log(`  ${done}/${rows.length} fetched — ${found.length} images, ${noImage} without, ${fetchErrors} unreachable`)
    }
  }
}

const queue = [...rows]
await Promise.all(Array.from({ length: CONCURRENCY }, () => worker(queue)))
console.log(`Fetched ${done}: ${found.length} images found, ${noImage} pages without one, ${fetchErrors} unreachable`)

if (!APPLY) {
  console.log('Dry run — rerun with --apply to write.')
  process.exit(0)
}

let written = 0
for (let i = 0; i < found.length; i += SQL_CHUNK) {
  const chunk = found.slice(i, i + SQL_CHUNK)
  const sql = chunk
    .map(({ id, image }) => {
      const escaped = image.replace(/'/g, "''")
      return `UPDATE "Article" SET image_url = '${escaped}' WHERE id = ${Number(id)} AND ${NEEDS_IMAGE};`
    })
    .join('\n')
  const path = `/tmp/backfill-images-${i}.sql`
  writeFileSync(path, sql)
  const results = d1File(path)
  rmSync(path, { force: true })
  written += results.reduce((sum, r) => sum + (r.meta?.changes ?? 0), 0)
  console.log(`  wrote chunk ${i / SQL_CHUNK + 1}/${Math.ceil(found.length / SQL_CHUNK)}`)
}
console.log(`Done: ${written} rows updated.`)
