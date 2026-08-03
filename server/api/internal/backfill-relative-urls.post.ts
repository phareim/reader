import { getD1 } from '~/server/utils/cloudflare'
import { fetchArticleContent, storeArticleContent } from '~/server/utils/article-content'
import { resolveContentUrls } from '~/server/utils/resolveContentUrls'

/**
 * POST /api/internal/backfill-relative-urls — one-shot repair of stored
 * article bodies whose root-/document-relative img/a URLs predate the
 * 2026-08-03 fix (resolveContentUrls now runs at parse/full-text-extract
 * time for new content, so only pre-fix rows need this). Bearer
 * NUXT_CRON_KEY.
 *
 * Cursor-paginated by id rather than a marker column — there is nothing
 * ongoing to flag, this is a single sweep. Pass `afterId` from the previous
 * response's `lastId` (query string) and repeat until `done: true`. An
 * already-absolute body round-trips byte-identical, so re-running a batch
 * (or the whole sweep) is harmless.
 *
 * `limit` (query string, default 50, capped at 50) trims the batch size —
 * unlike the other backfills, this one re-parses each stored body through
 * linkedom, which is CPU-heavy enough that a run of image-dense articles
 * can trip the Worker's per-request CPU limit (error 1102); drop it to
 * ~10-15 and retry when that happens.
 */
const DEFAULT_BATCH = 50

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event)
  const auth = getHeader(event, 'authorization') || ''
  if (!config.cronKey || auth !== `Bearer ${config.cronKey}`) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const query = getQuery(event)
  const afterId = Number(query.afterId) || 0
  const batchSize = Math.min(Math.max(Number(query.limit) || DEFAULT_BATCH, 1), DEFAULT_BATCH)

  const db = getD1(event)
  const batch = await db.prepare(
    `SELECT id, url, content_key FROM "Article" WHERE id > ? AND content_key IS NOT NULL ORDER BY id LIMIT ${batchSize}`
  ).bind(afterId).all()

  const rows = (batch.results || []) as Array<{ id: number; url: string; content_key: string }>

  let changed = 0
  for (const row of rows) {
    const html = await fetchArticleContent(event, row.content_key)
    if (!html) continue
    const resolved = resolveContentUrls(html, row.url)
    if (resolved !== html) {
      await storeArticleContent(event, row.id, resolved)
      changed++
    }
  }

  const lastId = rows.length ? rows[rows.length - 1].id : afterId

  return { processed: rows.length, changed, lastId, done: rows.length < batchSize }
})
