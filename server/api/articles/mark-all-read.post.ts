import { Prisma } from '@prisma/client'
import { getServerSession } from '#auth'
import prisma from '~/server/utils/db'

export default defineEventHandler(async (event) => {
  const session = await getServerSession(event)
  if (!session || !session.user?.email) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized'
    })
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true }
  })

  if (!user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'User not found'
    })
  }

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

    const feed = await prisma.feed.findFirst({
      where: {
        id: targetFeedId,
        userId: user.id
      },
      select: { id: true }
    })

    if (!feed) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Feed not found'
      })
    }
  }

  try {
    const where: Prisma.ArticleWhereInput = {
      isRead: false,
      feed: {
        userId: user.id
      }
    }

    if (targetFeedId !== undefined) {
      where.feedId = targetFeedId
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
