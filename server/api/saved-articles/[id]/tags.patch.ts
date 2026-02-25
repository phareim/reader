/**
 * PATCH /api/saved-articles/[id]/tags
 * Update tags for a saved article (replaces all tags with new ones)
 */

import { getAuthenticatedUser } from '~/server/utils/auth'
import { getD1 } from '~/server/utils/cloudflare'
import { z } from 'zod'

const updateSavedArticleTagsSchema = z.object({
  tags: z.array(z.string().min(1).max(50).trim())
})

export default defineEventHandler(async (event) => {
  const user = await getAuthenticatedUser(event)

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

  try {
    const db = getD1(event)

    const savedArticle = await db.prepare(
      'SELECT id FROM "SavedArticle" WHERE id = ? AND user_id = ?'
    ).bind(savedArticleId, user.id).first()

    if (!savedArticle) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Saved article not found'
      })
    }

    await db.prepare('DELETE FROM "SavedArticleTag" WHERE saved_article_id = ?')
      .bind(savedArticleId)
      .run()

    const now = new Date().toISOString()
    for (const tagName of tagNames) {
      await db.prepare(
        `
        INSERT OR IGNORE INTO "Tag" (user_id, name)
        VALUES (?, ?)
        `
      ).bind(user.id, tagName).run()

      const tag = await db.prepare(
        `
        SELECT id FROM "Tag" WHERE user_id = ? AND name = ?
        `
      ).bind(user.id, tagName).first()

      if (tag) {
        await db.prepare(
          `
          INSERT OR IGNORE INTO "SavedArticleTag" (saved_article_id, tag_id, tagged_at)
          VALUES (?, ?, ?)
          `
        ).bind(savedArticleId, tag.id, now).run()
      }
    }

    return {
      success: true,
      tags: tagNames
    }
  } catch (error: any) {
    if (error.statusCode) {
      throw error
    }

    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to update tags',
      message: error.message
    })
  }
})
