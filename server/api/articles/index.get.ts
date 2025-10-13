import prisma from '~/server/utils/db'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)

  const feedId = query.feedId ? parseInt(query.feedId as string) : undefined
  const isRead = query.isRead === 'true' ? true : query.isRead === 'false' ? false : undefined
  const isStarred = query.isStarred === 'true' ? true : undefined
  const limit = Math.min(parseInt(query.limit as string) || 50, 200)
  const offset = parseInt(query.offset as string) || 0

  try {
    const where: any = {}

    if (feedId !== undefined) {
      where.feedId = feedId
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
        publishedAt: article.publishedAt?.toISOString(),
        isRead: article.isRead,
        isStarred: article.isStarred,
        readAt: article.readAt?.toISOString()
      })),
      total,
      hasMore: offset + articles.length < total
    }
  } catch (error: any) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to fetch articles',
      message: error.message
    })
  }
})
