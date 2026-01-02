/**
 * PATCH /api/feeds/[id]/tags
 * Update tags for a feed (replaces all tags with new ones)
 */

import { getAuthenticatedUser } from '~/server/utils/auth'
import { getSupabaseClient } from '~/server/utils/supabase'
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
    const supabase = getSupabaseClient(event)

    // Use database function to update tags atomically
    const { error } = await supabase
      .rpc('update_feed_tags', {
        p_user_id: user.id,
        p_feed_id: feedId,
        p_tag_names: tagNames
      })

    if (error) {
      // Check if it's a "not found" error from the function
      if (error.message.includes('not found') || error.message.includes('unauthorized')) {
        throw createError({
          statusCode: 404,
          statusMessage: 'Feed not found'
        })
      }
      throw error
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
