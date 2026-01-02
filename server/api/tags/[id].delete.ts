/**
 * DELETE /api/tags/[id]
 * Delete a tag (and all its associations)
 */

import { getAuthenticatedUser } from '~/server/utils/auth'
import { getSupabaseClient } from '~/server/utils/supabase'

export default defineEventHandler(async (event) => {
  const user = await getAuthenticatedUser(event)
  const supabase = getSupabaseClient(event)

  const tagId = parseInt(event.context.params?.id || '')
  if (isNaN(tagId)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid tag ID'
    })
  }

  // Verify tag belongs to user
  const { data: existingTag, error: findError } = await supabase
    .from('Tag')
    .select('id')
    .eq('id', tagId)
    .eq('user_id', user.id)
    .single()

  if (findError || !existingTag) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Tag not found'
    })
  }

  // Delete the tag (cascade will handle FeedTag and SavedArticleTag)
  const { error: deleteError } = await supabase
    .from('Tag')
    .delete()
    .eq('id', tagId)

  if (deleteError) {
    throw createError({
      statusCode: 500,
      message: deleteError.message
    })
  }

  return { success: true }
})
