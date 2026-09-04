import { getAuthenticatedUser } from '~/server/utils/auth'
import { getD1 } from '~/server/utils/cloudflare'

export default defineEventHandler(async (event) => {
  // Get authenticated user (supports both session and MCP token)
  const user = await getAuthenticatedUser(event)

  try {
    const db = getD1(event)

    // newest_article_at is a correlated MAX() over idx_article_feed_id_published_at:
    // one index seek per feed. The GROUP BY it replaced scanned every article
    // the user owns (~16K rows per feed-list load, 2026-09-04).
    const [feedsResult, unreadCountsResult, feedTagsResult] = await Promise.all([
      db.prepare(`
        SELECT
          id,
          title,
          url,
          description,
          site_url,
          favicon_url,
          last_fetched_at,
          last_error,
          error_count,
          is_active,
          kind,
          half_life_hours,
          created_at,
          (SELECT MAX(a.published_at) FROM "Article" a WHERE a.feed_id = "Feed".id) AS newest_article_at
        FROM "Feed"
        WHERE user_id = ?
        ORDER BY created_at ASC
      `).bind(user.id).all(),
      db.prepare(`
        SELECT feed_id, COUNT(*) AS unread_count
        FROM "Article"
        WHERE is_read = 0
          AND feed_id IN (SELECT id FROM "Feed" WHERE user_id = ?)
        GROUP BY feed_id
      `).bind(user.id).all(),
      db.prepare(`
        SELECT ft.feed_id, t.name AS tag_name
        FROM "FeedTag" ft
        JOIN "Tag" t ON t.id = ft.tag_id
        WHERE t.user_id = ?
      `).bind(user.id).all()
    ])

    const unreadCountMap = new Map(
      (unreadCountsResult.results || []).map((item: any) => [item.feed_id, Number(item.unread_count)])
    )

    const tagMap = new Map<number, string[]>()
    for (const row of feedTagsResult.results || []) {
      const list = tagMap.get(row.feed_id) || []
      list.push(row.tag_name)
      tagMap.set(row.feed_id, list)
    }

    return {
      feeds: (feedsResult.results || []).map((feed: any) => ({
        id: feed.id,
        title: feed.title,
        url: feed.url,
        description: feed.description,
        siteUrl: feed.site_url,
        faviconUrl: feed.favicon_url,
        tags: (tagMap.get(feed.id) || []).sort(),
        unreadCount: unreadCountMap.get(feed.id) || 0,
        lastFetchedAt: feed.last_fetched_at,
        lastError: feed.last_error,
        errorCount: Number(feed.error_count || 0),
        newestArticleAt: feed.newest_article_at || null,
        isActive: Boolean(feed.is_active),
        kind: feed.kind || 'rss',
        halfLifeHours: feed.half_life_hours ?? null
      }))
    }
  } catch (error: any) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to fetch feeds',
      message: error.message
    })
  }
})
