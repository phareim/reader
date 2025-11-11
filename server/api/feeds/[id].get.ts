import { getAuthenticatedUser } from '~/server/utils/auth'
import prisma from '~/server/utils/db'

export default defineEventHandler(async (event) => {
  // Optional authentication - public read access allowed
  const user = await getAuthenticatedUser(event)

  const feedId = parseInt(event.context.params?.id || '')

  if (isNaN(feedId)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid feed ID'
    })
  }

  // Fetch the feed - if user is logged in, only show their feeds
  // If not logged in, allow viewing any feed
  const feed = await prisma.feed.findFirst({
    where: {
      id: feedId,
      // Only filter by user if authenticated
      ...(user ? { userId: user.id } : {})
    },
    include: {
      _count: {
        select: {
          articles: {
            where: user ? { isRead: false } : {}
          }
        }
      },
      tags: {
        include: {
          tag: true
        }
      }
    }
  })

  if (!feed) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Feed not found'
    })
  }

  return {
    id: feed.id,
    title: feed.title,
    url: feed.url,
    description: feed.description,
    siteUrl: feed.siteUrl,
    faviconUrl: feed.faviconUrl,
    tags: feed.tags.map(ft => ft.tag.name),
    unreadCount: user ? feed._count.articles : 0,
    lastFetchedAt: feed.lastFetchedAt?.toISOString(),
    isActive: feed.isActive,
    isAuthenticated: !!user
  }
})
