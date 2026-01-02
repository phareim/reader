import { getAuthenticatedUser } from '~/server/utils/auth'
import { getSupabaseClient } from '~/server/utils/supabase'

export default defineEventHandler(async (event) => {
  // Get authenticated user (supports both session and MCP token)
  const user = await getAuthenticatedUser(event)

  try {
    const supabase = getSupabaseClient(event)

    // Fetch feeds and unread counts in parallel
    const [feedsResult, unreadCountsResult] = await Promise.all([
      // Get feeds with tags
      supabase
        .from('Feed')
        .select(`
          *,
          tags:FeedTag(
            tag:Tag(name)
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: true }),

      // Get unread counts using database function
      supabase.rpc('get_unread_counts_by_feed', { p_user_id: user.id })
    ])

    if (feedsResult.error) {
      throw createError({
        statusCode: 500,
        message: feedsResult.error.message
      })
    }

    // Create a map of feedId -> unread count for O(1) lookup
    const unreadCountMap = new Map(
      (unreadCountsResult.data || []).map(item => [item.feed_id, Number(item.unread_count)])
    )

    return {
      feeds: feedsResult.data.map(feed => ({
        id: feed.id,
        title: feed.title,
        url: feed.url,
        description: feed.description,
        siteUrl: feed.site_url,
        faviconUrl: feed.favicon_url,
        tags: feed.tags.map(ft => ft.tag.name),
        unreadCount: unreadCountMap.get(feed.id) || 0,
        lastFetchedAt: feed.last_fetched_at,
        lastError: feed.last_error,
        errorCount: feed.error_count,
        isActive: feed.is_active
      }))
    }
  } catch (error: any) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to fetch feeds',
      message: error.message
    })
  }
})
