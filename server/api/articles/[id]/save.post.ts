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

  // Verify article exists and belongs to user's feed
  const article = await prisma.article.findFirst({
    where: {
      id: articleId,
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

  try {
    // Create or update saved article
    const savedArticle = await prisma.savedArticle.upsert({
      where: {
        userId_articleId: {
          userId: user.id,
          articleId: articleId
        }
      },
      create: {
        userId: user.id,
        articleId: articleId
      },
      update: {
        savedAt: new Date()
      }
    })

    return {
      success: true,
      savedArticle: {
        id: savedArticle.id,
        articleId: savedArticle.articleId,
        savedAt: savedArticle.savedAt.toISOString()
      }
    }
  } catch (error: any) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to save article',
      message: error.message
    })
  }
})
