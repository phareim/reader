import { getAuthenticatedUser } from '~/server/utils/auth'
import { getSupabaseClient } from '~/server/utils/supabase'

export default defineEventHandler(async (event) => {
  const user = await getAuthenticatedUser(event)

  const id = parseInt(getRouterParam(event, 'id') || '')
  const body = await readBody(event)
  const { isRead } = body

  if (isNaN(id)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid article ID'
    })
  }

  if (typeof isRead !== 'boolean') {
    throw createError({
      statusCode: 400,
      statusMessage: 'isRead must be a boolean'
    })
  }

  try {
    const supabase = getSupabaseClient(event)

    // Verify article exists and belongs to user's feed
    const { data: article, error: checkError } = await supabase
      .from('Article')
      .select('id, Feed!inner(user_id)')
      .eq('id', id)
      .eq('Feed.user_id', user.id)
      .single()

    if (checkError || !article) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Article not found'
      })
    }

    // Update the article
    const { error } = await supabase
      .from('Article')
      .update({
        is_read: isRead,
        read_at: isRead ? new Date().toISOString() : null
      })
      .eq('id', id)

    if (error) {
      throw error
    }

    return { success: true }
  } catch (error: any) {
    if (error.statusCode) {
      throw error
    }

    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to update article',
      message: error.message
    })
  }
})
