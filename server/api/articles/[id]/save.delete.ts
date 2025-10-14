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

  // Get article ID from route params
  const articleId = parseInt(getRouterParam(event, 'id') || '')
  if (isNaN(articleId)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid article ID'
    })
  }

  try {
    // Delete saved article
    await prisma.savedArticle.deleteMany({
      where: {
        userId: user.id,
        articleId: articleId
      }
    })

    return {
      success: true
    }
  } catch (error: any) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to unsave article',
      message: error.message
    })
  }
})
