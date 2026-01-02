import { getAuthenticatedUser } from '~/server/utils/auth'
import { getSupabaseClient } from '~/server/utils/supabase'

export default defineEventHandler(async (event) => {
  const user = await getAuthenticatedUser(event)
  const supabase = getSupabaseClient(event)

  const id = parseInt(getRouterParam(event, 'id') || '')

  if (isNaN(id)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid feed ID'
    })
  }

  try {
    // Verify feed belongs to user
    const { data: feed, error: feedError } = await supabase
      .from('Feed')
      .select('id')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (feedError || !feed) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Feed not found'
      })
    }

    // Count articles before deletion (for response)
    const { count: articleCount } = await supabase
      .from('Article')
      .select('*', { count: 'exact', head: true })
      .eq('feed_id', id)

    // Delete feed (articles will be cascade deleted)
    const { error: deleteError } = await supabase
      .from('Feed')
      .delete()
      .eq('id', id)

    if (deleteError) {
      throw deleteError
    }

    return {
      success: true,
      deletedArticles: articleCount || 0
    }
  } catch (error: any) {
    // If it's already a createError, rethrow it
    if (error.statusCode) {
      throw error
    }

    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to delete feed',
      message: error.message
    })
  }
})
