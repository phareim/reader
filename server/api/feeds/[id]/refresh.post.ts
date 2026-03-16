import { getAuthenticatedUser } from '~/server/utils/auth'
import { getD1 } from '~/server/utils/cloudflare'
import { syncSingleFeed } from '~/server/utils/feedSync'

export default defineEventHandler(async (event) => {
  const user = await getAuthenticatedUser(event)
  const db = getD1(event)

  const id = parseInt(getRouterParam(event, 'id') || '')

  if (isNaN(id)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid feed ID'
    })
  }

  // Verify feed exists and belongs to user
  const feed = await db.prepare(
    'SELECT id, url, title, user_id FROM "Feed" WHERE id = ? AND user_id = ?'
  ).bind(id, user.id).first()

  if (!feed) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Feed not found'
    })
  }

  const result = await syncSingleFeed(event, feed as any)

  if (!result.success) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to refresh feed',
      message: result.error
    })
  }

  return {
    success: true,
    newArticles: result.newArticles
  }
})
