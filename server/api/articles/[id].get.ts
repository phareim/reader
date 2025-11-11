import { getAuthenticatedUser } from '~/server/utils/auth'
import prisma from '~/server/utils/db'

export default defineEventHandler(async (event) => {
  // Optional authentication - public read access allowed
  const user = await getAuthenticatedUser(event)

  const articleId = parseInt(event.context.params?.id || '')

  if (isNaN(articleId)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid article ID'
    })
  }

  // Fetch the article - if user is logged in, only show their articles
  // If not logged in, allow viewing any article
  const article = await prisma.article.findFirst({
    where: {
      id: articleId,
      // Only filter by user if authenticated
      ...(user ? { feed: { userId: user.id } } : {})
    },
    include: {
      feed: {
        select: {
          id: true,
          title: true,
          faviconUrl: true
        }
      },
      ...(user ? {
        savedBy: {
          where: {
            userId: user.id
          },
          include: {
            tags: {
              include: {
                tag: true
              }
            }
          }
        }
      } : {})
    }
  })

  if (!article) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Article not found'
    })
  }

  // Transform the response
  const savedArticle = user ? (article as any).savedBy?.[0] : null

  return {
    id: article.id,
    title: article.title,
    url: article.url,
    content: article.content,
    summary: article.summary,
    author: article.author,
    publishedAt: article.publishedAt?.toISOString(),
    // Personal data only if authenticated
    isRead: user ? article.isRead : false,
    readAt: user ? article.readAt?.toISOString() : null,
    feedId: article.feedId,
    feedTitle: article.feed.title,
    feedFaviconUrl: article.feed.faviconUrl,
    savedId: savedArticle?.id,
    tags: savedArticle?.tags.map(t => t.tag.name) || [],
    // Indicate if user is authenticated (for UI purposes)
    isAuthenticated: !!user
  }
})
