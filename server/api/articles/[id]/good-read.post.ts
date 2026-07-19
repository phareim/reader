import { getAuthenticatedUser } from '~/server/utils/auth'
import { getD1 } from '~/server/utils/cloudflare'

export default defineEventHandler(async (event) => {
  const user = await getAuthenticatedUser(event)

  const articleId = parseInt(getRouterParam(event, 'id') || '')
  if (isNaN(articleId)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid article ID'
    })
  }

  try {
    const db = getD1(event)
    const article = await db.prepare(
      `
      SELECT a.id
      FROM "Article" a
      JOIN "Feed" f ON f.id = a.feed_id
      WHERE a.id = ? AND f.user_id = ?
      `
    ).bind(articleId, user.id).first()

    if (!article) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Article not found'
      })
    }

    await db.prepare(
      `
      INSERT OR IGNORE INTO "GoodRead" (user_id, article_id, created_at)
      VALUES (?, ?, ?)
      `
    ).bind(user.id, articleId, new Date().toISOString()).run()

    return { success: true }
  } catch (error: any) {
    if (error.statusCode) {
      throw error
    }

    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to mark as good read',
      message: error.message
    })
  }
})
