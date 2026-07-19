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
    await db.prepare('DELETE FROM "GoodRead" WHERE user_id = ? AND article_id = ?')
      .bind(user.id, articleId)
      .run()

    return { success: true }
  } catch (error: any) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to unmark good read',
      message: error.message
    })
  }
})
