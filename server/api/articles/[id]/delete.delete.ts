/**
 * DELETE /api/articles/:id
 * Delete an article entirely (only for manually added articles)
 * This is different from unsaving - this actually deletes the article
 */

import prisma from '~/server/utils/db'
import { getAuthenticatedUser } from '~/server/utils/auth'

export default defineEventHandler(async (event) => {
  const user = await getAuthenticatedUser(event)

  const articleId = parseInt(getRouterParam(event, 'id') || '')
  if (isNaN(articleId)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid article ID'
    })
  }

  try {
    // Get the article with its feed
    const article = await prisma.article.findUnique({
      where: { id: articleId },
      include: {
        feed: true
      }
    })

    if (!article) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Article not found'
      })
    }

    // Verify the article belongs to the user's feed
    if (article.feed.userId !== user.id) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Forbidden'
      })
    }

    // Only allow deletion of manually added articles (from Manual Additions feed)
    if (article.feed.title !== 'Manual Additions') {
      throw createError({
        statusCode: 400,
        statusMessage: 'Can only delete manually added articles',
        message: 'Regular feed articles cannot be deleted. You can unsave them instead.'
      })
    }

    // Delete the article (cascade will handle saved articles)
    await prisma.article.delete({
      where: { id: articleId }
    })

    return {
      success: true,
      message: 'Article deleted successfully'
    }
  } catch (error: any) {
    if (error.statusCode) {
      throw error
    }

    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to delete article',
      message: error.message
    })
  }
})
