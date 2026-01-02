/**
 * GET /api/tags
 * Get all tags for the authenticated user
 */

import { getAuthenticatedUser } from '~/server/utils/auth'
import { getSupabaseClient } from '~/server/utils/supabase'

export default defineEventHandler(async (event) => {
  const user = await getAuthenticatedUser(event)
  const supabase = getSupabaseClient(event)

  // Get all tags with their usage counts
  const { data: tags, error } = await supabase
    .from('Tag')
    .select(`
      *,
      feeds:FeedTag(count),
      saved_articles:SavedArticleTag(count)
    `)
    .eq('user_id', user.id)
    .order('name', { ascending: true })

  if (error) {
    throw createError({
      statusCode: 500,
      message: error.message
    })
  }

  return (tags || []).map(tag => ({
    id: tag.id,
    name: tag.name,
    color: tag.color,
    createdAt: tag.created_at,
    feedCount: tag.feeds.length,
    savedArticleCount: tag.saved_articles.length
  }))
})
