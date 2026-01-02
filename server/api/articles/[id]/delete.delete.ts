/**
 * DELETE /api/articles/:id
 * Delete an article entirely (only for manually added articles)
 * This is different from unsaving - this actually deletes the article
 */

import { getAuthenticatedUser } from '~/server/utils/auth'
import { getSupabaseClient } from '~/server/utils/supabase'

export default defineEventHandler(async (event) => {
  const user = await getAuthenticatedUser(event)
  const supabase = getSupabaseClient(event)

  const articleId = parseInt(getRouterParam(event, 'id') || '')
  if (isNaN(articleId)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid article ID'
    })
  }

  try {
    // Get the article with its feed
    const { data: article, error: articleError } = await supabase
      .from('Article')
      .select(`
        id,
        feed:Feed!inner (
          user_id,
          title
        )
      `)
      .eq('id', articleId)
      .single()

    if (articleError || !article) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Article not found'
      })
    }

    // Verify the article belongs to the user's feed
    if (article.feed.user_id !== user.id) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Forbidden'
      })
    }

    // Only allow deletion of manually added articles (from Manual Additions feed)
    if (article.feed.title !== 'Manual Additions') {
      throw createError({
        statusCode: 400,
        statusMessage: 'Can only delete manually added articles',
        message: 'Regular feed articles cannot be deleted. You can unsave them instead.'
      })
    }

    // Delete the article (cascade will handle saved articles)
    const { error: deleteError } = await supabase
      .from('Article')
      .delete()
      .eq('id', articleId)

    if (deleteError) {
      throw deleteError
    }

    return {
      success: true,
      message: 'Article deleted successfully'
    }
  } catch (error: any) {
    if (error.statusCode) {
      throw error
    }

    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to delete article',
      message: error.message
    })
  }
})
