import prisma from '~/server/utils/db'
import { getServerSession } from '#auth'

export default defineEventHandler(async (event) => {
  // Get authenticated user
  const session = await getServerSession(event)
  if (!session || !session.user?.email) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized'
    })
  }

  // Get user from database
  const user = await prisma.user.findUnique({
    where: { email: session.user.email }
  })

  if (!user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'User not found'
    })
  }

  const feedId = parseInt(getRouterParam(event, 'id') || '')
  if (isNaN(feedId)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid feed ID'
    })
  }

  const body = await readBody(event)
  const { tags } = body

  if (!Array.isArray(tags)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Tags must be an array'
    })
  }

  // Validate tags are strings
  if (!tags.every(tag => typeof tag === 'string')) {
    throw createError({
      statusCode: 400,
      statusMessage: 'All tags must be strings'
    })
  }

  try {
    // Verify feed belongs to user
    const feed = await prisma.feed.findFirst({
      where: {
        id: feedId,
        userId: user.id
      }
    })

    if (!feed) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Feed not found'
      })
    }

    // Update feed tags
    const updatedFeed = await prisma.feed.update({
      where: { id: feedId },
      data: {
        tags: JSON.stringify(tags)
      }
    })

    return {
      success: true,
      tags: JSON.parse(updatedFeed.tags)
    }
  } catch (error: any) {
    // If it's already a createError, rethrow it
    if (error.statusCode) {
      throw error
    }

    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to update feed tags',
      message: error.message
    })
  }
})
