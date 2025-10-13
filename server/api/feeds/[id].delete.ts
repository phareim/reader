import prisma from '~/server/utils/db'

export default defineEventHandler(async (event) => {
  const id = parseInt(getRouterParam(event, 'id') || '')

  if (isNaN(id)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid feed ID'
    })
  }

  try {
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
