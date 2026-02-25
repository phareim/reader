import { getAuthenticatedUser } from '~/server/utils/auth'
import { getD1 } from '~/server/utils/cloudflare'
import { parseFeed } from '~/server/utils/feedParser'
import { insertArticleWithContent } from '~/server/utils/article-store'

interface SyncResult {
  feedId: number
  feedTitle: string
  success: boolean
  newArticles?: number
  error?: string
}

interface FeedToSync {
  id: number
  url: string
  title: string
  user_id: string
}

async function syncFeed(event: any, feed: FeedToSync): Promise<SyncResult> {
  const db = getD1(event)
  try {
    const parsedFeed = await parseFeed(feed.url)

    // Update feed metadata
    await db.prepare(
      `
      UPDATE "Feed"
      SET title = ?,
          description = ?,
          site_url = ?,
          favicon_url = ?,
          last_fetched_at = ?,
          last_error = NULL,
          error_count = 0
      WHERE id = ? AND user_id = ?
      `
    ).bind(
      parsedFeed.title,
      parsedFeed.description || null,
      parsedFeed.siteUrl || null,
      parsedFeed.faviconUrl || null,
      new Date().toISOString(),
      feed.id,
      feed.user_id
    ).run()

    const maxArticles = Number(process.env.MAX_ARTICLES_PER_FEED) || 500
    const articlesToAdd = parsedFeed.items.slice(0, maxArticles)

    let articlesAdded = 0
    for (const item of articlesToAdd) {
      const result = await insertArticleWithContent(event, feed.id, {
        guid: item.guid,
        title: item.title,
        url: item.url,
        author: item.author,
        content: item.content,
        summary: item.summary,
        imageUrl: item.imageUrl,
        publishedAt: item.publishedAt
      })
      if (result.inserted) {
        articlesAdded += 1
      }
    }

    return {
      feedId: feed.id,
      feedTitle: feed.title,
      success: true,
      newArticles: articlesAdded
    }
  } catch (error: any) {
    // On error, increment error count and deactivate after 10 errors
    try {
      const current = await db.prepare(
        'SELECT error_count FROM "Feed" WHERE id = ? AND user_id = ?'
      ).bind(feed.id, feed.user_id).first()

      if (current) {
        const nextErrorCount = (current.error_count || 0) + 1
        await db.prepare(
          `
          UPDATE "Feed"
          SET last_error = ?,
              error_count = ?,
              is_active = ?
          WHERE id = ? AND user_id = ?
          `
        ).bind(
          error.message,
          nextErrorCount,
          nextErrorCount >= 10 ? 0 : 1,
          feed.id,
          feed.user_id
        ).run()
      }
    } catch (updateError) {
      // Ignore errors during error tracking update
    }

    return {
      feedId: feed.id,
      feedTitle: feed.title,
      success: false,
      error: error.message
    }
  }
}

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
        batch.map(feed => syncFeed(event, feed))
      )

      results.push(...batchResults.map((r, idx) =>
        r.status === 'fulfilled'
          ? r.value
          : {
              feedId: batch[idx].id,
              feedTitle: batch[idx].title,
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
