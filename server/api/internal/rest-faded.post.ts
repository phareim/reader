import { getD1 } from '~/server/utils/cloudflare'
import { DECAY } from '~/utils/decay'

/**
 * Nightly rest for faded articles (Bearer NUXT_CRON_KEY, systemd timer
 * `reader-rest-faded.timer` on Sleeper). An rss article past the fade
 * horizon (3 half-lives, utils/decay.ts) is already invisible in the deck;
 * leaving it unread just made every feed-list and deck load scan the whole
 * backlog. This marks such articles read with `rested_at` set and `read_at`
 * NULL, so reading stats never count them. Exempt: found/manual feeds and
 * the ∞ pace (they keep their backlog by design), starred articles, and
 * anything with a saved reading position (the "Continue reading" strip).
 *
 * Batched (`limit`, default 2000) — the trigger script repeats until
 * `done: true`. The SQL age/half-life expressions mirror
 * server/api/articles/index.get.ts; change them in lockstep.
 */
const DEFAULT_LIMIT = 2000

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event)
  const auth = getHeader(event, 'authorization') || ''
  if (!config.cronKey || auth !== `Bearer ${config.cronKey}`) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const query = getQuery(event)
  const limit = Math.min(Math.max(parseInt(query.limit as string) || DEFAULT_LIMIT, 1), 5000)
  const now = new Date().toISOString()

  const ageHours = `(julianday(?1) - julianday(COALESCE(a.published_at, a.created_at))) * 24.0`
  const halfLifeHours = `COALESCE(NULLIF(NULLIF(f.half_life_hours, 0), ${DECAY.FOREVER_HOURS}), ${DECAY.DEFAULT_HALF_LIFE_HOURS})`

  const result = await getD1(event).prepare(
    `
    UPDATE "Article"
    SET is_read = 1, read_at = NULL, rested_at = ?1
    WHERE id IN (
      SELECT a.id
      FROM "Article" a
      JOIN "Feed" f ON f.id = a.feed_id
      WHERE a.is_read = 0
        AND a.is_starred = 0
        AND a.read_progress = 0
        AND f.kind = 'rss'
        AND COALESCE(f.half_life_hours, 0) != ${DECAY.FOREVER_HOURS}
        AND ${ageHours} >= ${halfLifeHours} * ${DECAY.FADE_HORIZON}
      LIMIT ?2
    )
    `
  ).bind(now, limit).run()

  const rested = result?.meta?.changes ?? 0
  return { rested, done: rested < limit }
})
