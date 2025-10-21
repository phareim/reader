import prisma from '~/server/utils/db'
import { getAuthenticatedUser } from '~/server/utils/auth'

export default defineEventHandler(async (event) => {
  // Get authenticated user (supports both session and MCP token)
  const user = await getAuthenticatedUser(event)

  try {
    // Get optional tag filter from query params
    const query = getQuery(event)
    const tagFilter = query.tag as string | undefined

    // Build where clause
    const whereClause: any = {
      userId: user.id
    }

    // If tag filter is provided, only return saved articles with that tag
    if (tagFilter) {
      if (tagFilter === '__inbox__') {
        // Special case: show untagged saved articles
        whereClause.tags = {
          none: {}
        }
      } else {
        // Filter by specific tag
        whereClause.tags = {
          some: {
            tag: {
              name: tagFilter
            }
          }
        }
      }
    }

    // Fetch all saved articles for the user
    const savedArticles = await prisma.savedArticle.findMany({
      where: whereClause,
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
