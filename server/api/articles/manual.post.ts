/**
 * POST /api/articles/manual
 * Add a manual article (not from RSS feed) and save it
 * This allows Claude to add articles it finds interesting
 */

import { getAuthenticatedUser } from '~/server/utils/auth'
import prisma from '~/server/utils/db'
import { z } from 'zod'

const manualArticleSchema = z.object({
  title: z.string().min(1).max(500),
  url: z.string().url(),
  content: z.string().optional(),
  summary: z.string().optional(),
  author: z.string().optional(),
  tags: z.array(z.string().min(1).max(50)).optional()
})

export default defineEventHandler(async (event) => {
  const user = await getAuthenticatedUser(event)

  const body = await readBody(event)
  const validation = manualArticleSchema.safeParse(body)

  if (!validation.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid request body',
      data: validation.error.issues
    })
  }

  const { title, url, content, summary, author, tags } = validation.data

  try {
    // Find or create "Manual Additions" feed
    let manualFeed = await prisma.feed.findFirst({
      where: {
        userId: user.id,
        title: 'Manual Additions'
      }
    })

    if (!manualFeed) {
      manualFeed = await prisma.feed.create({
        data: {
          userId: user.id,
          title: 'Manual Additions',
          url: 'manual://additions',
          siteUrl: null,
          isActive: true
        }
      })
    }

    // Create the article and save it in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Check if article with this URL already exists for this user
      const existingArticle = await tx.article.findFirst({
        where: {
          feedId: manualFeed!.id,
          url: url
        }
      })

      let article
      if (existingArticle) {
        // Update existing article
        article = await tx.article.update({
          where: { id: existingArticle.id },
          data: {
            title,
            content,
            summary,
            author
          }
        })
      } else {
        // Create new article
        article = await tx.article.create({
          data: {
            feedId: manualFeed!.id,
            guid: `manual-${Date.now()}-${Math.random()}`,
            title,
            url,
            content,
            summary,
            author,
            publishedAt: new Date(),
            isRead: false,
            isStarred: false
          }
        })
      }

      // Save the article
      const savedArticle = await tx.savedArticle.upsert({
        where: {
          userId_articleId: {
            userId: user.id,
            articleId: article.id
          }
        },
        create: {
          userId: user.id,
          articleId: article.id
        },
        update: {
          savedAt: new Date()
        }
      })

      // Add tags if provided
      if (tags && tags.length > 0) {
        // Clear existing tags
        await tx.savedArticleTag.deleteMany({
          where: { savedArticleId: savedArticle.id }
        })

        // Add new tags
        for (const tagName of tags) {
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
            update: {}
          })

          await tx.savedArticleTag.create({
            data: {
              savedArticleId: savedArticle.id,
              tagId: tag.id
            }
          })
        }
      }

      return {
        article,
        savedArticle
      }
    })

    return {
      success: true,
      article: {
        id: result.article.id,
        title: result.article.title,
        url: result.article.url,
        savedAt: result.savedArticle.savedAt.toISOString()
      },
      tags: tags || []
    }
  } catch (error: any) {
    console.error('Error adding manual article:', error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to add manual article',
      message: error.message
    })
  }
})
