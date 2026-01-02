import { getAuthenticatedUser } from '~/server/utils/auth'
import { getSupabaseClient } from '~/server/utils/supabase'

export default defineEventHandler(async (event) => {
  const user = await getAuthenticatedUser(event)

  const body = await readBody(event)
  const { feedId } = body ?? {}

  let targetFeedId: number | undefined

  if (feedId !== undefined) {
    targetFeedId = Number(feedId)

    if (Number.isNaN(targetFeedId)) {
      throw createError({
        statusCode: 400,
        statusMessage: 'feedId must be a number'
      })
    }

    const supabase = getSupabaseClient(event)

    // Verify feed exists and belongs to user
    const { data: feed, error: feedError } = await supabase
      .from('Feed')
      .select('id')
      .eq('id', targetFeedId)
      .eq('user_id', user.id)
      .single()

    if (feedError || !feed) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Feed not found'
      })
    }
  }

  try {
    const supabase = getSupabaseClient(event)

    // First, get all article IDs that belong to user's feeds
    let articleQuery = supabase
      .from('Article')
      .select('id, Feed!inner(user_id)')
      .eq('is_read', false)
      .eq('Feed.user_id', user.id)

    if (targetFeedId !== undefined) {
      articleQuery = articleQuery.eq('feed_id', targetFeedId)
    }

    const { data: articles, error: selectError } = await articleQuery

    if (selectError) {
      throw selectError
    }

    if (!articles || articles.length === 0) {
      return { markedCount: 0 }
    }

    // Update the articles
    const articleIds = articles.map(a => a.id)
    const { error, count } = await supabase
      .from('Article')
      .update({
        is_read: true,
        read_at: new Date().toISOString()
      })
      .in('id', articleIds)
      .select('id', { count: 'exact' })

    if (error) {
      throw error
    }

    return {
      markedCount: count || 0
    }
  } catch (error: any) {
    if (error.statusCode) {
      throw error
    }

    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to mark articles as read',
      message: error.message
    })
  }
})
