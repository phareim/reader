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

  const id = parseInt(getRouterParam(event, 'id') || '')
  const body = await readBody(event)
  const { isRead } = body

  if (isNaN(id)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid article ID'
    })
  }

  if (typeof isRead !== 'boolean') {
    throw createError({
      statusCode: 400,
      statusMessage: 'isRead must be a boolean'
    })
  }

  const article = await prisma.article.findFirst({
    where: {
      id,
      feed: {
        userId: user.id
      }
    },
    select: { id: true }
  })

  if (!article) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Article not found'
    })
  }

  try {
    await prisma.article.update({
      where: { id },
      data: {
        isRead,
        readAt: isRead ? new Date() : null
      }
    })

    return { success: true }
  } catch (error: any) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to update article',
      message: error.message
    })
  }
})
