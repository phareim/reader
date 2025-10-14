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

  const id = parseInt(getRouterParam(event, 'id') || '')

  if (isNaN(id)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid feed ID'
    })
  }

  try {
    // Verify feed belongs to user
    const feed = await prisma.feed.findFirst({
      where: {
        id,
        userId: user.id
      }
    })

    if (!feed) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Feed not found'
      })
    }

    // Count articles before deletion (for response)
    const articleCount = await prisma.article.count({
      where: { feedId: id }
    })

    // Delete feed (articles will be cascade deleted)
    await prisma.feed.delete({
      where: { id }
    })

    return {
      success: true,
      deletedArticles: articleCount
    }
  } catch (error: any) {
    // If it's already a createError, rethrow it
    if (error.statusCode) {
      throw error
    }

    if (error.code === 'P2025') {
      throw createError({
        statusCode: 404,
        statusMessage: 'Feed not found'
      })
    }

    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to delete feed',
      message: error.message
    })
  }
})
