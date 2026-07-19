import { getAuthenticatedUser } from '~/server/utils/auth'
import { getD1 } from '~/server/utils/cloudflare'

export default defineEventHandler(async (event) => {
  const user = await getAuthenticatedUser(event)

  try {
    const db = getD1(event)

    const goodReadsResult = await db.prepare(
      `
      SELECT
        gr.created_at,
        a.id AS article_id,
        a.feed_id,
        a.title,
        a.url,
        a.author,
        a.summary,
        a.image_url,
        a.published_at,
        a.is_read,
        f.title AS feed_title
      FROM "GoodRead" gr
      JOIN "Article" a ON a.id = gr.article_id
      JOIN "Feed" f ON f.id = a.feed_id
      WHERE gr.user_id = ?
      ORDER BY gr.created_at DESC
      `
    ).bind(user.id).all()

    return {
      articles: (goodReadsResult.results || []).map((row: any) => ({
        id: row.article_id,
        feedId: row.feed_id,
        feedTitle: row.feed_title,
        title: row.title,
        url: row.url,
        author: row.author,
        content: null,
        summary: row.summary,
        imageUrl: row.image_url,
        publishedAt: row.published_at,
        isRead: Boolean(row.is_read),
        goodReadAt: row.created_at
      }))
    }
  } catch (error: any) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to fetch good reads',
      message: error.message
    })
  }
})
