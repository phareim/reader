import { getAuthenticatedUser } from '~/server/utils/auth'
import { getD1 } from '~/server/utils/cloudflare'
import { syncSingleFeed, type SyncResult } from '~/server/utils/feedSync'

export default defineEventHandler(async (event) => {
  const user = await getAuthenticatedUser(event)
  const db = getD1(event)

  try {
    const feedsResult = await db.prepare(
      `
      SELECT id, url, title, user_id
      FROM "Feed"
      WHERE user_id = ? AND is_active = 1
      `
    ).bind(user.id).all()

    const feeds = feedsResult.results || []

    if (feeds.length === 0) {
      return {
        results: [],
        summary: {
          total: 0,
          succeeded: 0,
          failed: 0,
          newArticles: 0
        }
      }
    }

    const concurrencyLimit = 5
    const results: SyncResult[] = []

    for (let i = 0; i < feeds.length; i += concurrencyLimit) {
      const batch = feeds.slice(i, i + concurrencyLimit)
      const batchResults = await Promise.allSettled(
        batch.map(feed => syncSingleFeed(event, feed as any))
      )

      results.push(...batchResults.map((r, idx) =>
        r.status === 'fulfilled'
          ? r.value
          : {
              feedId: batch[idx].id as number,
              feedTitle: batch[idx].title as string,
              success: false,
              error: 'Unexpected error during sync'
            }
      ))
    }

    const summary = {
      total: results.length,
      succeeded: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      newArticles: results.reduce((sum, r) => sum + (r.newArticles || 0), 0)
    }

    return {
      results,
      summary
    }
  } catch (error: any) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Sync failed',
      message: error.message
    })
  }
})
