import { discoverFeeds } from '~/server/utils/feedDiscovery'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { url } = body

  if (!url || typeof url !== 'string') {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid request',
      message: 'URL is required'
    })
  }

  try {
    const feeds = await discoverFeeds(url)

    if (feeds.length === 0) {
      throw createError({
        statusCode: 404,
        statusMessage: 'No feeds found',
        message: 'Could not discover any RSS or Atom feeds at this URL'
      })
    }

    return { feeds }
  } catch (error: any) {
    // If it's already a createError, rethrow it
    if (error.statusCode) {
      throw error
    }

    throw createError({
      statusCode: 500,
      statusMessage: 'Discovery failed',
      message: error.message
    })
  }
})
