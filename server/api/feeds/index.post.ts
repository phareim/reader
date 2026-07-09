import { getAuthenticatedUser } from '~/server/utils/auth'
import { addFeedForUser } from '~/server/utils/addFeed'

export default defineEventHandler(async (event) => {
  const user = await getAuthenticatedUser(event)

  const body = await readBody(event)
  const { url } = body

  if (!url || typeof url !== 'string') {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid request',
      message: 'Feed URL is required'
    })
  }

  try {
    const result = await addFeedForUser(event, user.id, url)

    if (result.existing) {
      throw createError({
        statusCode: 409,
        statusMessage: 'Feed already exists',
        message: 'This feed is already in your subscription list'
      })
    }

    return {
      feed: result.feed,
      articlesAdded: result.articlesAdded
    }
  } catch (error: any) {
    // If it's already a createError, rethrow it
    if (error.statusCode) {
      throw error
    }

    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to add feed',
      message: error.message
    })
  }
})
