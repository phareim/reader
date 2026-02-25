import { getAuthenticatedUser } from '~/server/utils/auth'
import { getD1 } from '~/server/utils/cloudflare'

export default defineEventHandler(async (event) => {
  const user = await getAuthenticatedUser(event)

  const id = parseInt(getRouterParam(event, 'id') || '')
  const body = await readBody(event)
  const { isRead } = body

  if (isNaN(id)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid article ID'
    })
  }

  if (typeof isRead !== 'boolean') {
    throw createError({
      statusCode: 400,
      statusMessage: 'isRead must be a boolean'
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
    ).bind(id, user.id).first()

    if (!article) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Article not found'
      })
    }

    await db.prepare(
      `
      UPDATE "Article"
      SET is_read = ?, read_at = ?
      WHERE id = ?
      `
    ).bind(isRead ? 1 : 0, isRead ? new Date().toISOString() : null, id).run()

    return { success: true }
  } catch (error: any) {
    if (error.statusCode) {
      throw error
    }

    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to update article',
      message: error.message
    })
  }
})
