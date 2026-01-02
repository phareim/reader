import { getAuthenticatedUser } from '~/server/utils/auth'
import { getSupabaseClient } from '~/server/utils/supabase'

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

  try {
    const supabase = getSupabaseClient(event)

    // Delete saved article
    const { error } = await supabase
      .from('SavedArticle')
      .delete()
      .eq('user_id', user.id)
      .eq('article_id', articleId)

    if (error) {
      throw error
    }

    return {
      success: true
    }
  } catch (error: any) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to unsave article',
      message: error.message
    })
  }
})
