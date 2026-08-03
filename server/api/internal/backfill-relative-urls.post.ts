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
 */
const BATCH = 50

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event)
  const auth = getHeader(event, 'authorization') || ''
  if (!config.cronKey || auth !== `Bearer ${config.cronKey}`) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const afterId = Number(getQuery(event).afterId) || 0

  const db = getD1(event)
  const batch = await db.prepare(
    `SELECT id, url, content_key FROM "Article" WHERE id > ? AND content_key IS NOT NULL ORDER BY id LIMIT ${BATCH}`
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

  return { processed: rows.length, changed, lastId, done: rows.length < BATCH }
})
