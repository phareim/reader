import { getD1 } from '~/server/utils/cloudflare'
import { scoreInterest } from '~/server/utils/interest'

/**
 * POST /api/internal/score-interest — fill `Article.interest` (migration
 * 021) for unscored, unread articles from the last 7 days via TypeSafe Jev
 * (`server/utils/interest.ts`). Bearer NUXT_CRON_KEY, cross-user like
 * sync-stale/rest-faded. `?limit=` batch (default 60, cap 200) fetched
 * through a small concurrency pool (TypeSafe is ~0.5s/call, but each call is
 * still a Worker subrequest). Found/manual articles are scored too — it's
 * harmless, `interest` only feeds the decay boost and feed `kind` still
 * governs fading. A row whose call fails (scoreInterest never throws) is
 * left NULL and picked up by the next run.
 */
const DEFAULT_LIMIT = 60
const MAX_LIMIT = 200
const CONCURRENCY = 5

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event)
  const auth = getHeader(event, 'authorization') || ''
  if (!config.cronKey || auth !== `Bearer ${config.cronKey}`) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const query = getQuery(event)
  const limit = Math.min(Math.max(parseInt(query.limit as string) || DEFAULT_LIMIT, 1), MAX_LIMIT)

  const db = getD1(event)
  const batch = await db.prepare(
    `
    SELECT a.id, a.title, a.summary, f.title AS feed_title
    FROM "Article" a
    JOIN "Feed" f ON f.id = a.feed_id
    WHERE a.interest IS NULL
      AND a.is_read = 0
      AND COALESCE(a.published_at, a.created_at) >= datetime('now', '-7 days')
    ORDER BY COALESCE(a.published_at, a.created_at) DESC
    LIMIT ?
    `
  ).bind(limit).all()

  const rows = (batch.results || []) as Array<{
    id: number
    title: string
    summary: string | null
    feed_title: string
  }>

  let scored = 0
  let next = 0
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, rows.length) }, async () => {
      while (next < rows.length) {
        const row = rows[next++]
        const score = await scoreInterest(event, {
          feed: row.feed_title,
          title: row.title,
          summary: row.summary,
        })
        if (score !== null) {
          await db.prepare('UPDATE "Article" SET interest = ? WHERE id = ?')
            .bind(score, row.id).run()
          scored++
        }
      }
    })
  )

  return { attempted: rows.length, scored, done: rows.length < limit }
})
