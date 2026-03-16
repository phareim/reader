/**
 * PATCH /api/feeds/[id]/tags
 * Update tags for a feed (replaces all tags with new ones)
 */

import { getAuthenticatedUser } from '~/server/utils/auth'
import { getD1 } from '~/server/utils/cloudflare'
import { getOrCreateTag } from '~/server/utils/tags'
import { z } from 'zod'

const updateFeedTagsSchema = z.object({
  tags: z.array(z.string().min(1).max(50).trim())
})

export default defineEventHandler(async (event) => {
  const user = await getAuthenticatedUser(event)

  const feedId = parseInt(event.context.params?.id || '')
  if (isNaN(feedId)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid feed ID'
    })
  }

  const body = await readBody(event)
  const validation = updateFeedTagsSchema.safeParse(body)

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

    const feed = await db.prepare(
      'SELECT id FROM "Feed" WHERE id = ? AND user_id = ?'
    ).bind(feedId, user.id).first()

    if (!feed) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Feed not found'
      })
    }

    await db.prepare('DELETE FROM "FeedTag" WHERE feed_id = ?')
      .bind(feedId)
      .run()

    const now = new Date().toISOString()
    for (const tagName of tagNames) {
      const tagId = await getOrCreateTag(db, user.id, tagName)
      await db.prepare(
        'INSERT OR IGNORE INTO "FeedTag" (feed_id, tag_id, tagged_at) VALUES (?, ?, ?)'
      ).bind(feedId, tagId, now).run()
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
      statusMessage: 'Failed to update feed tags',
      message: error.message
    })
  }
})
