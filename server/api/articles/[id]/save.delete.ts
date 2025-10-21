import prisma from '~/server/utils/db'
import { getAuthenticatedUser } from '~/server/utils/auth'

export default defineEventHandler(async (event) => {
  // Get authenticated user (supports both session and MCP token)
  const user = await getAuthenticatedUser(event)

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
