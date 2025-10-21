import prisma from '~/server/utils/db'
import { getAuthenticatedUser } from '~/server/utils/auth'

export default defineEventHandler(async (event) => {
  // Get authenticated user (supports both session and MCP token)
  const user = await getAuthenticatedUser(event)

  // Get article ID from route params
  const articleId = parseInt(getRouterParam(event, 'id') || '')
  if (isNaN(articleId)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid article ID'
    })
  }

  // Verify article exists and belongs to user's feed, and fetch feed tags
  const article = await prisma.article.findFirst({
    where: {
      id: articleId,
      feed: {
        userId: user.id
      }
    },
    include: {
      feed: {
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

  try {
    // Get feed's tag names
    const feedTags = article.feed.tags.map(ft => ft.tag.name)

    // Use transaction to ensure consistency
    const savedArticle = await prisma.$transaction(async (tx) => {
      // Create or update saved article
      const saved = await tx.savedArticle.upsert({
        where: {
          userId_articleId: {
            userId: user.id,
            articleId: articleId
          }
        },
        create: {
          userId: user.id,
          articleId: articleId
        },
        update: {
          savedAt: new Date()
        }
      })

      // Only copy tags when creating a new saved article
      // (Don't override existing tags when re-saving)
      // Check if this is a new save by seeing if there are existing tags
      const existingTags = await tx.savedArticleTag.findMany({
        where: { savedArticleId: saved.id }
      })

      // Only copy feed tags if there are no existing tags
      if (existingTags.length === 0 && feedTags.length > 0) {
        // Create SavedArticleTag associations for each feed tag
        for (const tagName of feedTags) {
          // Find or create the tag
          const tag = await tx.tag.upsert({
            where: {
              userId_name: {
                userId: user.id,
                name: tagName
              }
            },
            create: {
              userId: user.id,
              name: tagName
            },
            update: {} // No update needed if it exists
          })

          // Create the SavedArticleTag association
          await tx.savedArticleTag.create({
            data: {
              savedArticleId: saved.id,
              tagId: tag.id
            }
          })
        }
      }

      return saved
    })

    return {
      success: true,
      savedArticle: {
        id: savedArticle.id,
        articleId: savedArticle.articleId,
        savedAt: savedArticle.savedAt.toISOString()
      }
    }
  } catch (error: any) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to save article',
      message: error.message
    })
  }
})
