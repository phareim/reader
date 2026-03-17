import { getD1 } from '~/server/utils/cloudflare'
import { parseFeed } from '~/server/utils/feedParser'
import { insertArticleWithContent } from '~/server/utils/article-store'

export interface SyncResult {
  feedId: number
  feedTitle: string
  success: boolean
  newArticles?: number
  error?: string
}

interface FeedInfo {
  id: number
  url: string
  title: string
  user_id: string
}

/**
 * Sync a single feed: parse, update metadata, insert new articles, track errors.
 */
export async function syncSingleFeed(event: any, feed: FeedInfo): Promise<SyncResult> {
  const db = getD1(event)
  try {
    const parsedFeed = await parseFeed(feed.url)

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
    try {
      await db.prepare(
        `UPDATE "Feed"
         SET last_error = ?,
             error_count = error_count + 1,
             is_active = CASE WHEN error_count + 1 >= 10 THEN 0 ELSE 1 END
         WHERE id = ? AND user_id = ?`
      ).bind(error.message, feed.id, feed.user_id).run()
    } catch {
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
