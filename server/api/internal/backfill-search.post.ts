import { getD1 } from '~/server/utils/cloudflare'
import { fetchArticleContent } from '~/server/utils/article-content'
import { indexArticleFts } from '~/server/utils/searchIndex'

/**
 * POST /api/internal/backfill-search — index articles that predate the
 * ArticleFts table (migration 014). Bearer NUXT_CRON_KEY. One batch per
 * call (each article costs an R2 read + two D1 writes, so the batch stays
 * well under the Worker's subrequest cap); run repeatedly until it
 * reports remaining: 0.
 */
const BATCH = 50

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event)
  const auth = getHeader(event, 'authorization') || ''
  if (!config.cronKey || auth !== `Bearer ${config.cronKey}`) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const db = getD1(event)
  const batch = await db.prepare(
    `
    SELECT id, title, summary, content_key
    FROM "Article"
    WHERE id NOT IN (SELECT rowid FROM "ArticleFts")
    ORDER BY id
    LIMIT ${BATCH}
    `
  ).all()

  let indexed = 0
  for (const row of (batch.results || []) as Array<{
    id: number; title: string; summary: string | null; content_key: string | null
  }>) {
    const bodyHtml = await fetchArticleContent(event, row.content_key)
    await indexArticleFts(event, {
      id: row.id,
      title: row.title,
      summary: row.summary,
      bodyHtml
    })
    indexed++
  }

  const remaining = await db.prepare(
    'SELECT COUNT(*) AS n FROM "Article" WHERE id NOT IN (SELECT rowid FROM "ArticleFts")'
  ).first<{ n: number }>()

  return { indexed, remaining: Number(remaining?.n ?? 0) }
})
