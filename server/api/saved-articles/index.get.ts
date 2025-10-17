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
    // Fetch all saved articles for the user
    const savedArticles = await prisma.savedArticle.findMany({
      where: {
        userId: user.id
      },
      include: {
        article: {
          include: {
            feed: true
          }
        },
        tags: {
          include: {
            tag: true
          }
        }
      },
      orderBy: {
        savedAt: 'desc'
      }
    })

    return {
      articles: savedArticles.map(saved => ({
        id: saved.article.id,
        feedId: saved.article.feedId,
        feedTitle: saved.article.feed.title,
        title: saved.article.title,
        url: saved.article.url,
        author: saved.article.author,
        content: saved.article.content,
        summary: saved.article.summary,
        publishedAt: saved.article.publishedAt?.toISOString(),
        isRead: saved.article.isRead,
        savedAt: saved.savedAt.toISOString(),
        savedId: saved.id,
        tags: saved.tags.map(sat => sat.tag.name)
      }))
    }
  } catch (error: any) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to fetch saved articles',
      message: error.message
    })
  }
})
