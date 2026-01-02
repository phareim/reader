/**
 * PATCH /api/saved-articles/[id]/tags
 * Update tags for a saved article (replaces all tags with new ones)
 */

import { getAuthenticatedUser } from '~/server/utils/auth'
import { getSupabaseClient } from '~/server/utils/supabase'
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
    const supabase = getSupabaseClient(event)

    // Verify saved article belongs to user
    const { data: savedArticle, error: savedArticleError } = await supabase
      .from('SavedArticle')
      .select('id')
      .eq('id', savedArticleId)
      .eq('user_id', user.id)
      .single()

    if (savedArticleError || !savedArticle) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Saved article not found'
      })
    }

    // Use database function to update tags atomically
    const { error } = await supabase
      .rpc('update_saved_article_tags', {
        p_user_id: user.id,
        p_saved_article_id: savedArticleId,
        p_tag_names: tagNames
      })

    if (error) {
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
      statusMessage: 'Failed to update tags',
      message: error.message
    })
  }
})
