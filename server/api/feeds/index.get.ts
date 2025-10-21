import prisma from '~/server/utils/db'
import { getAuthenticatedUser } from '~/server/utils/auth'

export default defineEventHandler(async (event) => {
  // Get authenticated user (supports both session and MCP token)
  const user = await getAuthenticatedUser(event)

  try {
    const feeds = await prisma.feed.findMany({
      where: {
        userId: user.id
      },
      include: {
        _count: {
          select: {
            articles: {
              where: { isRead: false }
            }
          }
        },
        tags: {
          include: {
            tag: true
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
        tags: feed.tags.map(ft => ft.tag.name),
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
