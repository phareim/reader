import { getAuthenticatedUser } from '~/server/utils/auth'
import { getD1 } from '~/server/utils/cloudflare'

export default defineEventHandler(async (event) => {
  // Optional authentication - public read access allowed for specific feeds
  const user = await getAuthenticatedUser(event)

  const query = getQuery(event)

  const feedIdParam = query.feedId as string | undefined
  const feedIdsParam = query.feedIds as string | undefined
  const isRead = query.isRead === 'true' ? true : query.isRead === 'false' ? false : undefined
  const isStarred = query.isStarred === 'true' ? true : undefined
  const excludeSaved = query.excludeSaved === 'true'
  const limit = Math.min(parseInt(query.limit as string) || 50, 200)
  const offset = parseInt(query.offset as string) || 0

  try {
    const db = getD1(event)

    let allowedFeedIds: number[] | undefined

    // Handle single feedId
    if (feedIdParam !== undefined) {
      const parsedFeedId = Number(feedIdParam)

      if (Number.isNaN(parsedFeedId)) {
        throw createError({
          statusCode: 400,
          statusMessage: 'Invalid feed ID'
        })
      }

      const feed = await db.prepare('SELECT id FROM "Feed" WHERE id = ? AND user_id = ?')
        .bind(parsedFeedId, user.id)
        .first()

      if (!feed) {
        throw createError({
          statusCode: 404,
          statusMessage: 'Feed not found'
        })
      }

      allowedFeedIds = [parsedFeedId]
    }
    // Handle multiple feedIds
    else if (feedIdsParam) {
      const requestedFeedIds = feedIdsParam
        .split(',')
        .map(id => Number(id.trim()))
        .filter(id => !Number.isNaN(id))

      if (requestedFeedIds.length === 0) {
        throw createError({
          statusCode: 400,
          statusMessage: 'Invalid feed IDs'
        })
      }

      const placeholders = requestedFeedIds.map(() => '?').join(',')
      const feedsResult = await db.prepare(
        `SELECT id FROM "Feed" WHERE user_id = ? AND id IN (${placeholders})`
      ).bind(user.id, ...requestedFeedIds).all()

      allowedFeedIds = (feedsResult.results || []).map((feed: any) => feed.id)

      if (!allowedFeedIds || allowedFeedIds.length === 0) {
        return {
          articles: [],
          total: 0,
          hasMore: false
        }
      }
    }
    // No specific feed - filter by user's feeds
    else if (user) {
      const feedsResult = await db.prepare('SELECT id FROM "Feed" WHERE user_id = ?')
        .bind(user.id)
        .all()
      allowedFeedIds = (feedsResult.results || []).map((feed: any) => feed.id)
    }

    if (!allowedFeedIds || allowedFeedIds.length === 0) {
      return {
        articles: [],
        total: 0,
        hasMore: false
      }
    }

    const params: any[] = []
    let where = `a.feed_id IN (${allowedFeedIds.map(() => '?').join(',')})`
    params.push(...allowedFeedIds)

    if (isRead !== undefined) {
      where += ' AND a.is_read = ?'
      params.push(isRead ? 1 : 0)
    }

    if (isStarred !== undefined) {
      where += ' AND a.is_starred = 1'
    }

    if (excludeSaved) {
      where += ' AND a.id NOT IN (SELECT article_id FROM "SavedArticle" WHERE user_id = ?)'
      params.push(user.id)
    }

    const countResult = await db.prepare(
      `SELECT COUNT(*) AS total FROM "Article" a WHERE ${where}`
    ).bind(...params).first()

    const articlesResult = await db.prepare(
      `
      SELECT
        a.id,
        a.feed_id,
        a.guid,
        a.title,
        a.url,
        a.author,
        a.summary,
        a.image_url,
        a.published_at,
        a.is_read,
        a.is_starred,
        a.read_at,
        f.title AS feed_title,
        f.favicon_url AS feed_favicon
      FROM "Article" a
      JOIN "Feed" f ON f.id = a.feed_id
      WHERE ${where}
      ORDER BY a.published_at DESC
      LIMIT ? OFFSET ?
      `
    ).bind(...params, limit, offset).all()

    return {
      articles: (articlesResult.results || []).map((article: any) => ({
        id: article.id,
        feedId: article.feed_id,
        feedTitle: article.feed_title,
        feedFavicon: article.feed_favicon,
        guid: article.guid,
        title: article.title,
        url: article.url,
        author: article.author,
        content: null,
        summary: article.summary,
        imageUrl: article.image_url,
        publishedAt: article.published_at,
        isRead: Boolean(article.is_read),
        isStarred: Boolean(article.is_starred),
        readAt: article.read_at
      })),
      total: Number(countResult?.total || 0),
      hasMore: offset + (articlesResult.results?.length || 0) < Number(countResult?.total || 0)
    }
  } catch (error: any) {
    if (error.statusCode) {
      throw error
    }

    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to fetch articles',
      message: error.message
    })
  }
})
