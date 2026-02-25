import { getAuthenticatedUser } from '~/server/utils/auth'
import { getD1 } from '~/server/utils/cloudflare'

export default defineEventHandler(async (event) => {
  const user = await getAuthenticatedUser(event)

  const body = await readBody(event)
  const { feedId } = body ?? {}

  let targetFeedId: number | undefined

  if (feedId !== undefined) {
    targetFeedId = Number(feedId)

    if (Number.isNaN(targetFeedId)) {
      throw createError({
        statusCode: 400,
        statusMessage: 'feedId must be a number'
      })
    }

    const db = getD1(event)
    const feed = await db.prepare('SELECT id FROM "Feed" WHERE id = ? AND user_id = ?')
      .bind(targetFeedId, user.id)
      .first()

    if (!feed) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Feed not found'
      })
    }
  }

  try {
    const db = getD1(event)
    const params: any[] = [user.id]
    let where = 'is_read = 0 AND feed_id IN (SELECT id FROM "Feed" WHERE user_id = ?)'

    if (targetFeedId !== undefined) {
      where += ' AND feed_id = ?'
      params.push(targetFeedId)
    }

    const countResult = await db.prepare(
      `SELECT COUNT(*) AS total FROM "Article" WHERE ${where}`
    ).bind(...params).first()

    if (!countResult || Number(countResult.total) === 0) {
      return { markedCount: 0 }
    }

    await db.prepare(
      `UPDATE "Article" SET is_read = 1, read_at = ? WHERE ${where}`
    ).bind(new Date().toISOString(), ...params).run()

    return {
      markedCount: Number(countResult.total || 0)
    }
  } catch (error: any) {
    if (error.statusCode) {
      throw error
    }

    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to mark articles as read',
      message: error.message
    })
  }
})
