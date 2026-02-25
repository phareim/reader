import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { promisify } from 'node:util'
import { execFile } from 'node:child_process'
import dotenv from 'dotenv'

const execFileAsync = promisify(execFile)

const ROOT = process.cwd()

dotenv.config({ path: path.join(ROOT, '.env') })
dotenv.config({ path: path.join(ROOT, '.env.local') })

type SupabaseRow = Record<string, any>

type WranglerConfig = {
  databaseName: string
  bucketName: string
}

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env/.env.local')
}

const config = readWranglerConfig()

const REST_BASE = `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1`
try {
  new URL(REST_BASE)
} catch {
  throw new Error('SUPABASE_URL is not a valid URL. Check your .env/.env.local configuration.')
}
const REQUEST_HEADERS = {
  apikey: SUPABASE_SERVICE_ROLE_KEY,
  Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
  'Content-Type': 'application/json'
}

const BATCH_SIZE_DEFAULT = Number(process.env.BATCH_SIZE || 500)

const main = async () => {
  console.log('Starting Supabase → D1/R2 migration...')
  console.log(`Using D1 database: ${config.databaseName}`)
  console.log(`Using R2 bucket: ${config.bucketName}`)

  const stage = (process.env.MIGRATION_STAGE || 'all').toLowerCase()

  if (stage === 'all' || stage === 'meta') {
    await migrateUsers()
    await migrateFeeds()
    await migrateTags()
  }

  if (stage === 'all' || stage === 'articles') {
    await migrateArticles()
  }

  if (stage === 'all' || stage === 'saved') {
    await migrateSavedArticles()
  }

  if (stage === 'all' || stage === 'relations') {
    await migrateFeedTags()
    await migrateSavedArticleTags()
  }

  console.log('Migration complete.')
}

const migrateUsers = async () => {
  const rows = await fetchAll('User', ['id', 'name', 'email', 'email_verified', 'image', 'created_at', 'updated_at', 'mcp_token', 'mcp_token_created_at'])
  if (rows.length === 0) {
    console.log('Users: none found')
    return
  }
  console.log(`Users: ${rows.length} rows`)

  await insertBatch('User', rows, ['id', 'name', 'email', 'email_verified', 'image', 'created_at', 'updated_at', 'mcp_token', 'mcp_token_created_at'])
}

const migrateFeeds = async () => {
  const rows = await fetchAll('Feed', [
    'id',
    'user_id',
    'url',
    'title',
    'description',
    'site_url',
    'favicon_url',
    'last_fetched_at',
    'last_error',
    'error_count',
    'fetch_interval',
    'is_active',
    'created_at',
    'updated_at'
  ])

  if (rows.length === 0) {
    console.log('Feeds: none found')
    return
  }

  console.log(`Feeds: ${rows.length} rows`)

  const mapped = rows.map(row => ({
    ...row,
    is_active: row.is_active ? 1 : 0
  }))

  await insertBatch('Feed', mapped, [
    'id',
    'user_id',
    'url',
    'title',
    'description',
    'site_url',
    'favicon_url',
    'last_fetched_at',
    'last_error',
    'error_count',
    'fetch_interval',
    'is_active',
    'created_at',
    'updated_at'
  ])
}

const migrateTags = async () => {
  const rows = await fetchAll('Tag', ['id', 'user_id', 'name', 'color', 'created_at'])
  if (rows.length === 0) {
    console.log('Tags: none found')
    return
  }
  console.log(`Tags: ${rows.length} rows`)
  await insertBatch('Tag', rows, ['id', 'user_id', 'name', 'color', 'created_at'])
}

const migrateArticles = async () => {
  const total = await fetchTotal('Article')
  if (!total) {
    console.log('Articles: none found')
    return
  }
  console.log(`Articles: ${total} rows`)

  const limit = BATCH_SIZE_DEFAULT
  const startOffset = Number(process.env.ARTICLE_OFFSET || 0)
  const maxToProcess = Number(process.env.ARTICLE_LIMIT || 0)
  let offset = startOffset
  const endAt = maxToProcess > 0 ? Math.min(total, startOffset + maxToProcess) : total

  while (offset < endAt) {
    const batch = await fetchBatch('Article', [
      'id',
      'feed_id',
      'guid',
      'title',
      'url',
      'author',
      'content',
      'summary',
      'image_url',
      'published_at',
      'is_read',
      'is_starred',
      'read_at',
      'created_at'
    ], limit, offset)

    if (batch.length === 0) break

    const mapped: SupabaseRow[] = []

    for (const row of batch) {
      let contentKey: string | null = null
      if (row.content) {
        contentKey = `articles/${row.id}.html`
        await putR2Object(config.bucketName, contentKey, row.content, 'text/html; charset=utf-8')
      }

      mapped.push({
        id: row.id,
        feed_id: row.feed_id,
        guid: row.guid,
        title: row.title,
        url: row.url,
        author: row.author,
        summary: row.summary,
        image_url: row.image_url,
        content_key: contentKey,
        published_at: row.published_at,
        is_read: row.is_read ? 1 : 0,
        is_starred: row.is_starred ? 1 : 0,
        read_at: row.read_at,
        created_at: row.created_at
      })
    }

    await insertBatch('Article', mapped, [
      'id',
      'feed_id',
      'guid',
      'title',
      'url',
      'author',
      'summary',
      'image_url',
      'content_key',
      'published_at',
      'is_read',
      'is_starred',
      'read_at',
      'created_at'
    ])

    offset += batch.length
    console.log(`Articles migrated: ${Math.min(offset, endAt)}/${endAt} (overall ${Math.min(offset, total)}/${total})`)
  }
}

const migrateSavedArticles = async () => {
  const total = await fetchTotal('SavedArticle')
  if (!total) {
    console.log('SavedArticle: none found')
    return
  }

  console.log(`SavedArticle: ${total} rows`)

  const limit = BATCH_SIZE_DEFAULT
  const startOffset = Number(process.env.SAVED_OFFSET || 0)
  const maxToProcess = Number(process.env.SAVED_LIMIT || 0)
  let offset = startOffset
  const endAt = maxToProcess > 0 ? Math.min(total, startOffset + maxToProcess) : total

  while (offset < endAt) {
    const batch = await fetchBatch('SavedArticle', [
      'id',
      'user_id',
      'article_id',
      'saved_at',
      'note'
    ], limit, offset)

    if (batch.length === 0) break

    const mapped: SupabaseRow[] = []

    for (const row of batch) {
      let noteKey: string | null = null
      if (row.note) {
        noteKey = `notes/${row.id}.txt`
        await putR2Object(config.bucketName, noteKey, row.note, 'text/plain; charset=utf-8')
      }

      mapped.push({
        id: row.id,
        user_id: row.user_id,
        article_id: row.article_id,
        saved_at: row.saved_at,
        note_key: noteKey
      })
    }

    await insertBatch('SavedArticle', mapped, [
      'id',
      'user_id',
      'article_id',
      'saved_at',
      'note_key'
    ])

    offset += batch.length
    console.log(`Saved articles migrated: ${Math.min(offset, endAt)}/${endAt} (overall ${Math.min(offset, total)}/${total})`)
  }
}

const migrateFeedTags = async () => {
  const rows = await fetchAll('FeedTag', ['feed_id', 'tag_id', 'tagged_at'])
  if (rows.length === 0) {
    console.log('FeedTag: none found')
    return
  }
  console.log(`FeedTag: ${rows.length} rows`)
  await insertBatch('FeedTag', rows, ['feed_id', 'tag_id', 'tagged_at'])
}

const migrateSavedArticleTags = async () => {
  const rows = await fetchAll('SavedArticleTag', ['saved_article_id', 'tag_id', 'tagged_at'])
  if (rows.length === 0) {
    console.log('SavedArticleTag: none found')
    return
  }
  console.log(`SavedArticleTag: ${rows.length} rows`)
  await insertBatch('SavedArticleTag', rows, ['saved_article_id', 'tag_id', 'tagged_at'])
}

const fetchAll = async (table: string, columns: string[]) => {
  const total = await fetchTotal(table)
  if (!total) return []

  const limit = 1000
  let offset = 0
  const rows: SupabaseRow[] = []

  while (offset < total) {
    const batch = await fetchBatch(table, columns, limit, offset)
    if (batch.length === 0) break
    rows.push(...batch)
    offset += batch.length
  }

  return rows
}

const fetchTotal = async (table: string) => {
  const url = new URL(`${REST_BASE}/${table}`)
  url.searchParams.set('select', 'id')
  url.searchParams.set('limit', '1')

  const response = await fetch(url.toString(), {
    headers: {
      ...REQUEST_HEADERS,
      Prefer: 'count=exact'
    }
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Failed to fetch count for ${table}: ${response.status} ${text}`)
  }

  const contentRange = response.headers.get('content-range')
  if (!contentRange) return 0
  const total = Number(contentRange.split('/')[1])
  return Number.isFinite(total) ? total : 0
}

const fetchBatch = async (table: string, columns: string[], limit: number, offset: number) => {
  const url = new URL(`${REST_BASE}/${table}`)
  url.searchParams.set('select', columns.join(','))
  url.searchParams.set('limit', String(limit))
  url.searchParams.set('offset', String(offset))
  url.searchParams.set('order', 'id.asc')

  const response = await fetch(url.toString(), {
    headers: REQUEST_HEADERS
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Failed to fetch ${table}: ${response.status} ${text}`)
  }

  return (await response.json()) as SupabaseRow[]
}

const insertBatch = async (table: string, rows: SupabaseRow[], columns: string[]) => {
  if (rows.length === 0) return

  const batches = chunk(rows, 250)
  for (const batch of batches) {
    const sql = buildInsertSQL(table, batch, columns)
    await runD1SQL(sql)
  }
}

const buildInsertSQL = (table: string, rows: SupabaseRow[], columns: string[]) => {
  const values = rows.map(row => {
    const vals = columns.map(col => sqlValue(row[col]))
    return `(${vals.join(', ')})`
  })

  return `INSERT OR REPLACE INTO "${table}" (${columns.map(c => `"${c}"`).join(', ')}) VALUES\n${values.join(',\n')};\n`
}

const sqlValue = (value: any) => {
  if (value === null || value === undefined) return 'NULL'
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'NULL'
  if (typeof value === 'boolean') return value ? '1' : '0'

  const str = String(value)
    .replace(/\u0000/g, '')
    .replace(/'/g, "''")
  return `'${str}'`
}

const runD1SQL = async (sql: string) => {
  const tmpFile = path.join(os.tmpdir(), `d1-migrate-${Date.now()}-${Math.random().toString(16).slice(2)}.sql`)
  fs.writeFileSync(tmpFile, sql)
  try {
    await execFileAsync('npx', [
      'wrangler',
      'd1',
      'execute',
      config.databaseName,
      '--remote',
      `--file=${tmpFile}`
    ], { cwd: ROOT })
  } finally {
    fs.unlinkSync(tmpFile)
  }
}

const putR2Object = async (bucket: string, key: string, body: string, contentType: string) => {
  const tmpFile = path.join(os.tmpdir(), `r2-${Date.now()}-${Math.random().toString(16).slice(2)}`)
  fs.writeFileSync(tmpFile, body)
  try {
    await withRetries(async () => {
      await execFileAsync('npx', [
        'wrangler',
        'r2',
        'object',
        'put',
        `${bucket}/${key}`,
        `--file=${tmpFile}`,
        `--content-type=${contentType}`
      ], { cwd: ROOT })
    }, 5)
  } finally {
    fs.unlinkSync(tmpFile)
  }
}

const withRetries = async (fn: () => Promise<void>, attempts: number) => {
  let lastError: any
  for (let i = 0; i < attempts; i += 1) {
    try {
      await fn()
      return
    } catch (error: any) {
      lastError = error
      const delay = Math.min(5000, 500 * Math.pow(2, i))
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }
  throw lastError
}

const chunk = <T,>(arr: T[], size: number) => {
  const result: T[][] = []
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size))
  }
  return result
}

function readWranglerConfig(): WranglerConfig {
  const tomlPath = path.join(ROOT, 'wrangler.toml')
  const content = fs.readFileSync(tomlPath, 'utf-8')

  const databaseNameMatch = content.match(/database_name\s*=\s*"([^"]+)"/)
  const bucketNameMatch = content.match(/bucket_name\s*=\s*"([^"]+)"/)

  if (!databaseNameMatch || !bucketNameMatch) {
    throw new Error('Failed to parse database_name or bucket_name from wrangler.toml')
  }

  return {
    databaseName: databaseNameMatch[1],
    bucketName: bucketNameMatch[1]
  }
}

main().catch((error) => {
  const cause = (error as any)?.cause?.message ? ` (cause: ${(error as any).cause.message})` : ''
  console.error(`Migration failed: ${error.message}${cause}`)
  process.exit(1)
})
