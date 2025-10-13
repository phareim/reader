import prisma from '~/server/utils/db'

export default defineEventHandler(async (event) => {
  try {
    const feeds = await prisma.feed.findMany({
      include: {
        _count: {
          select: {
            articles: {
              where: { isRead: false }
            }
          }
        }
      },
      orderBy: { createdAt: 'asc' }
    })

    return {
      feeds: feeds.map(feed => ({
        id: feed.id,
        title: feed.title,
        url: feed.url,
        siteUrl: feed.siteUrl,
        faviconUrl: feed.faviconUrl,
        unreadCount: feed._count.articles,
        lastFetchedAt: feed.lastFetchedAt?.toISOString(),
        lastError: feed.lastError,
        errorCount: feed.errorCount,
        isActive: feed.isActive
      }))
    }
  } catch (error: any) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to fetch feeds',
      message: error.message
    })
  }
})
