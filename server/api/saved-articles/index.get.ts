import { getAuthenticatedUser } from '~/server/utils/auth'
import { getD1 } from '~/server/utils/cloudflare'

export default defineEventHandler(async (event) => {
  // Get authenticated user (supports both session and MCP token)
  const user = await getAuthenticatedUser(event)

  try {
    const db = getD1(event)

    // Get optional tag filter from query params
    const query = getQuery(event)
    const tagFilter = query.tag as string | undefined

    const params: any[] = [user.id]
    let where = 'sa.user_id = ?'

    if (tagFilter) {
      if (tagFilter === '__inbox__') {
        where += ' AND NOT EXISTS (SELECT 1 FROM "SavedArticleTag" sat2 WHERE sat2.saved_article_id = sa.id)'
      } else {
        where += `
          AND EXISTS (
            SELECT 1
            FROM "SavedArticleTag" sat2
            JOIN "Tag" t2 ON t2.id = sat2.tag_id
            WHERE sat2.saved_article_id = sa.id AND t2.name = ?
          )
        `
        params.push(tagFilter)
      }
    }

    const savedArticlesResult = await db.prepare(
      `
      SELECT
        sa.id AS saved_id,
        sa.saved_at,
        a.id AS article_id,
        a.feed_id,
        a.title,
        a.url,
        a.author,
        a.summary,
        a.image_url,
        a.published_at,
        a.is_read,
        f.title AS feed_title,
        GROUP_CONCAT(DISTINCT t.name) AS tags
      FROM "SavedArticle" sa
      JOIN "Article" a ON a.id = sa.article_id
      JOIN "Feed" f ON f.id = a.feed_id
      LEFT JOIN "SavedArticleTag" sat ON sat.saved_article_id = sa.id
      LEFT JOIN "Tag" t ON t.id = sat.tag_id
      WHERE ${where}
      GROUP BY sa.id
      ORDER BY sa.saved_at DESC
      `
    ).bind(...params).all()

    return {
      articles: (savedArticlesResult.results || []).map((saved: any) => ({
        id: saved.article_id,
        feedId: saved.feed_id,
        feedTitle: saved.feed_title,
        title: saved.title,
        url: saved.url,
        author: saved.author,
        content: null,
        summary: saved.summary,
        imageUrl: saved.image_url,
        publishedAt: saved.published_at,
        isRead: Boolean(saved.is_read),
        savedAt: saved.saved_at,
        savedId: saved.saved_id,
        tags: saved.tags ? String(saved.tags).split(',').sort() : []
      }))
    }
  } catch (error: any) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to fetch saved articles',
      message: error.message
    })
  }
})
