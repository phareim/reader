import { getAuthenticatedUser } from '~/server/utils/auth'
import prisma from '~/server/utils/db'

export default defineEventHandler(async (event) => {
  const user = await getAuthenticatedUser(event)

  if (!user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized'
    })
  }

  const articleId = parseInt(event.context.params?.id || '')

  if (isNaN(articleId)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid article ID'
    })
  }

  // Fetch the article and verify it belongs to one of the user's feeds
  const article = await prisma.article.findFirst({
    where: {
      id: articleId,
      feed: {
        userId: user.id
      }
    },
    include: {
      feed: {
        select: {
          id: true,
          title: true,
          faviconUrl: true
        }
      },
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
    }
  })

  if (!article) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Article not found'
    })
  }

  // Transform the response
  const savedArticle = article.savedBy[0]

  return {
    id: article.id,
    title: article.title,
    url: article.url,
    content: article.content,
    summary: article.summary,
    author: article.author,
    publishedAt: article.publishedAt?.toISOString(),
    isRead: article.isRead,
    readAt: article.readAt?.toISOString(),
    feedId: article.feedId,
    feedTitle: article.feed.title,
    feedFaviconUrl: article.feed.faviconUrl,
    savedId: savedArticle?.id,
    tags: savedArticle?.tags.map(t => t.tag.name) || []
  }
})
