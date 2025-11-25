import prisma from '~/server/utils/db'
import { getAuthenticatedUser } from '~/server/utils/auth'

export default defineEventHandler(async (event) => {
  // Get authenticated user (supports both session and MCP token)
  const user = await getAuthenticatedUser(event)

  try {
    // Fetch feeds and unread counts in parallel
    const [feeds, unreadCounts] = await Promise.all([
      // Get feeds with tags
      prisma.feed.findMany({
        where: {
          userId: user.id
        },
        include: {
          tags: {
            include: {
              tag: true
            }
          }
        },
        orderBy: { createdAt: 'asc' }
      }),
      // Get unread counts in a single aggregation query
      prisma.article.groupBy({
        by: ['feedId'],
        where: {
          isRead: false,
          feed: {
            userId: user.id
          }
        },
        _count: {
          id: true
        }
      })
    ])

    // Create a map of feedId -> unread count for O(1) lookup
    const unreadCountMap = new Map(
      unreadCounts.map(item => [item.feedId, item._count.id])
    )

    return {
      feeds: feeds.map(feed => ({
        id: feed.id,
        title: feed.title,
        url: feed.url,
        description: feed.description,
        siteUrl: feed.siteUrl,
        faviconUrl: feed.faviconUrl,
        tags: feed.tags.map(ft => ft.tag.name),
        unreadCount: unreadCountMap.get(feed.id) || 0,
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
