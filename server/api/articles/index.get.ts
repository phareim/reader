import { Prisma } from '@prisma/client'
import { getAuthenticatedUser } from '~/server/utils/auth'
import prisma from '~/server/utils/db'

export default defineEventHandler(async (event) => {
  // Optional authentication - public read access allowed for specific feeds
  const user = await getAuthenticatedUser(event)

  const query = getQuery(event)

  const feedIdParam = query.feedId as string | undefined
  const feedIdsParam = query.feedIds as string | undefined
  const isRead = query.isRead === 'true' ? true : query.isRead === 'false' ? false : undefined
  const isStarred = query.isStarred === 'true' ? true : undefined
  const excludeSaved = query.excludeSaved === 'true'
  const limit = Math.min(parseInt(query.limit as string) || 50, 200)
  const offset = parseInt(query.offset as string) || 0

  try {
    // Base where clause - only filter by user if authenticated and no specific feedId is provided
    const where: Prisma.ArticleWhereInput = {}

    // If user is authenticated but no specific feed requested, filter by user's feeds
    if (user && !feedIdParam) {
      where.feed = {
        userId: user.id
      }
    }

    if (feedIdParam !== undefined) {
      const parsedFeedId = Number(feedIdParam)

      if (Number.isNaN(parsedFeedId)) {
        throw createError({
          statusCode: 400,
          statusMessage: 'Invalid feed ID'
        })
      }

      // Check if feed exists (publicly accessible)
      const feed = await prisma.feed.findFirst({
        where: {
          id: parsedFeedId,
          // Only filter by user if authenticated
          ...(user ? { userId: user.id } : {})
        },
        select: { id: true }
      })

      if (!feed) {
        throw createError({
          statusCode: 404,
          statusMessage: 'Feed not found'
        })
      }

      where.feedId = parsedFeedId
    } else if (feedIdsParam) {
      const requestedFeedIds = feedIdsParam
        .split(',')
        .map(id => Number(id.trim()))
        .filter(id => !Number.isNaN(id))

      if (requestedFeedIds.length === 0) {
        throw createError({
          statusCode: 400,
          statusMessage: 'Invalid feed IDs'
        })
      }

      // If authenticated, only return user's feeds
      // If not authenticated, allow any feeds (for public sharing)
      const feedFilter = user
        ? { id: { in: requestedFeedIds }, userId: user.id }
        : { id: { in: requestedFeedIds } }

      const feeds = await prisma.feed.findMany({
        where: feedFilter,
        select: { id: true }
      })

      const allowedFeedIds = feeds.map(feed => feed.id)

      if (allowedFeedIds.length === 0) {
        return {
          articles: [],
          total: 0,
          hasMore: false
        }
      }

      where.feedId = { in: allowedFeedIds }
    }

    // Personal filters only apply when authenticated
    if (user) {
      if (isRead !== undefined) {
        where.isRead = isRead
      }

      if (isStarred !== undefined) {
        where.isStarred = isStarred
      }

      if (excludeSaved) {
        where.savedBy = {
          none: {
            userId: user.id
          }
        }
      }
    }

    const [articles, total] = await Promise.all([
      prisma.article.findMany({
        where,
        include: {
          feed: {
            select: {
              title: true,
              faviconUrl: true
            }
          }
        },
        orderBy: { publishedAt: 'desc' },
        take: limit,
        skip: offset
      }),
      prisma.article.count({ where })
    ])

    return {
      articles: articles.map(article => ({
        id: article.id,
        feedId: article.feedId,
        feedTitle: article.feed.title,
        feedFavicon: article.feed.faviconUrl,
        guid: article.guid,
        title: article.title,
        url: article.url,
        author: article.author,
        content: article.content,
        summary: article.summary,
        imageUrl: article.imageUrl,
        publishedAt: article.publishedAt?.toISOString(),
        isRead: article.isRead,
        isStarred: article.isStarred,
        readAt: article.readAt?.toISOString()
      })),
      total,
      hasMore: offset + articles.length < total
    }
  } catch (error: any) {
    if (error.statusCode) {
      throw error
    }

    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to fetch articles',
      message: error.message
    })
  }
})
