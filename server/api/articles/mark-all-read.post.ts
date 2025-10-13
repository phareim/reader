import prisma from '~/server/utils/db'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { feedId } = body

  try {
    const where: any = { isRead: false }

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
