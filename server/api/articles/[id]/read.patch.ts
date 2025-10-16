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

  try {
    // Verify article belongs to user's feed
    const article = await prisma.article.findFirst({
      where: {
        id,
        feed: {
          userId: user.id
        }
      }
    })

    if (!article) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Article not found'
      })
    }

    // Update the article
    await prisma.article.update({
      where: { id },
      data: {
        isRead,
        readAt: isRead ? new Date() : null
      }
    })

    return { success: true }
  } catch (error: any) {
    if (error.statusCode) {
      throw error
    }

    if (error.code === 'P2025') {
      throw createError({
        statusCode: 404,
        statusMessage: 'Article not found'
      })
    }

    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to update article',
      message: error.message
    })
  }
})
