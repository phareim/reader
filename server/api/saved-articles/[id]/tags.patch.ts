/**
 * PATCH /api/saved-articles/[id]/tags
 * Update tags for a saved article (replaces all tags with new ones)
 */

import { getServerSession } from '#auth'
import prisma from '~/server/utils/db'
import { z } from 'zod'

const updateSavedArticleTagsSchema = z.object({
  tags: z.array(z.string().min(1).max(50).trim())
})

export default defineEventHandler(async (event) => {
  const session = await getServerSession(event)
  if (!session?.user?.email) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized'
    })
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email }
  })

  if (!user) {
    throw createError({
      statusCode: 404,
      statusMessage: 'User not found'
    })
  }

  const savedArticleId = parseInt(event.context.params?.id || '')
  if (isNaN(savedArticleId)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid saved article ID'
    })
  }

  const body = await readBody(event)
  const validation = updateSavedArticleTagsSchema.safeParse(body)

  if (!validation.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid request body',
      data: validation.error.issues
    })
  }

  const { tags: tagNames } = validation.data

  // Verify saved article belongs to user
  const savedArticle = await prisma.savedArticle.findFirst({
    where: {
      id: savedArticleId,
      userId: user.id
    }
  })

  if (!savedArticle) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Saved article not found'
    })
  }

  // Use a transaction to ensure consistency
  await prisma.$transaction(async (tx) => {
    // 1. Delete all existing SavedArticleTag associations
    await tx.savedArticleTag.deleteMany({
      where: { savedArticleId }
    })

    // 2. Create or find tags and create new SavedArticleTag associations
    for (const tagName of tagNames) {
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
          savedArticleId,
          tagId: tag.id
        }
      })
    }
  })

  // Fetch the updated saved article with tags
  const updatedSavedArticle = await prisma.savedArticle.findUnique({
    where: { id: savedArticleId },
    include: {
      tags: {
        include: {
          tag: true
        }
      }
    }
  })

  return {
    success: true,
    tags: updatedSavedArticle?.tags.map(sat => sat.tag.name) || []
  }
})
