import { Prisma } from '@prisma/client'
import { getAuthenticatedUser } from '~/server/utils/auth'
import prisma from '~/server/utils/db'

export default defineEventHandler(async (event) => {
  const user = await getAuthenticatedUser(event)

  const query = getQuery(event)

  const feedIdParam = query.feedId as string | undefined
  const feedIdsParam = query.feedIds as string | undefined
  const isRead = query.isRead === 'true' ? true : query.isRead === 'false' ? false : undefined
  const isStarred = query.isStarred === 'true' ? true : undefined
  const limit = Math.min(parseInt(query.limit as string) || 50, 200)
  const offset = parseInt(query.offset as string) || 0

  try {
    const where: Prisma.ArticleWhereInput = {
      feed: {
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

      const feed = await prisma.feed.findFirst({
        where: {
          id: parsedFeedId,
          userId: user.id
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

      const ownedFeedIds = await prisma.feed.findMany({
        where: {
          id: { in: requestedFeedIds },
          userId: user.id
        },
        select: { id: true }
      })

      const allowedFeedIds = ownedFeedIds.map(feed => feed.id)

      if (allowedFeedIds.length === 0) {
        return {
          articles: [],
          total: 0,
          hasMore: false
        }
      }

      where.feedId = { in: allowedFeedIds }
    }

    if (isRead !== undefined) {
      where.isRead = isRead
    }

    if (isStarred !== undefined) {
      where.isStarred = isStarred
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
