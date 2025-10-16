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

  const body = await readBody(event)
  const { feedId } = body

  try {
    const where: any = {
      isRead: false,
      feed: {
        userId: user.id
      }
    }

    if (feedId !== undefined) {
      if (typeof feedId !== 'number') {
        throw createError({
          statusCode: 400,
          statusMessage: 'feedId must be a number'
        })
      }
      where.feedId = feedId
    }

    const result = await prisma.article.updateMany({
      where,
      data: {
        isRead: true,
        readAt: new Date()
      }
    })

    return {
      markedCount: result.count
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
