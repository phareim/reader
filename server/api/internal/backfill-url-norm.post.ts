import { getD1 } from '~/server/utils/cloudflare'
import { normalizeUrl } from '~/server/utils/urlNormalize'

/**
 * POST /api/internal/backfill-url-norm — one-shot backfill of Article.url_norm
 * (migration 012) for rows that predate insert-time normalization. Bearer
 * NUXT_CRON_KEY. Processes one batch per call; run repeatedly (curl in a
 * loop) until it reports remaining: 0. Un-normalizable URLs are stamped ''
 * so the batch query never revisits them (dedup lookups only ever bind
 * non-empty norms, so '' can't collide).
 */
const BATCH = 100

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event)
  const auth = getHeader(event, 'authorization') || ''
  if (!config.cronKey || auth !== `Bearer ${config.cronKey}`) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const db = getD1(event)
  const batch = await db.prepare(
    `SELECT id, url FROM "Article" WHERE url_norm IS NULL ORDER BY id LIMIT ${BATCH}`
  ).all()

  let updated = 0
  for (const row of (batch.results || []) as Array<{ id: number; url: string }>) {
    await db.prepare('UPDATE "Article" SET url_norm = ? WHERE id = ?')
      .bind(normalizeUrl(row.url) ?? '', row.id).run()
    updated++
  }

  const remaining = await db.prepare(
    'SELECT COUNT(*) AS n FROM "Article" WHERE url_norm IS NULL'
  ).first<{ n: number }>()

  return { updated, remaining: Number(remaining?.n ?? 0) }
})
