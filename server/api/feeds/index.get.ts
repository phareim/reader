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
        tags: JSON.parse(feed.tags || '[]'),
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
