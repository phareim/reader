import { getD1 } from '~/server/utils/cloudflare'
import { syncSingleFeed, type SyncResult } from '~/server/utils/feedSync'

/**
 * Background sync for ALL users' feeds, so nobody has to know about
 * shift+r. Called by a systemd timer on Sleeper (Bearer NUXT_CRON_KEY),
 * NOT by browsers. Each run takes the stalest active RSS feeds across
 * every user and syncs a small batch — article-content writes cost ~3
 * subrequests each against the Worker's 1000-cap, so the batch stays
 * small and freshness comes from the timer's cadence instead.
 */
const BATCH_SIZE = 5
const STALE_AFTER_MINUTES = 60

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event)
  const auth = getHeader(event, 'authorization') || ''
  if (!config.cronKey || auth !== `Bearer ${config.cronKey}`) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const db = getD1(event)
  const cutoff = new Date(Date.now() - STALE_AFTER_MINUTES * 60 * 1000).toISOString()

  const { results: feeds } = await db.prepare(
    `
    SELECT id, url, title, user_id
    FROM "Feed"
    WHERE is_active = 1
      AND kind = 'rss'
      AND (last_fetched_at IS NULL OR last_fetched_at < ?)
    ORDER BY last_fetched_at ASC NULLS FIRST
    LIMIT ?
    `
  ).bind(cutoff, BATCH_SIZE).all()

  const results: SyncResult[] = []
  for (const feed of feeds ?? []) {
    results.push(await syncSingleFeed(event, feed as any))
  }

  return {
    synced: results.length,
    newArticles: results.reduce((sum, r) => sum + (r.newArticles ?? 0), 0),
    failures: results.filter((r) => !r.success).map((r) => ({ feedId: r.feedId, error: r.error })),
  }
})
