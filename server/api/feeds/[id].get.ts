import { getSupabaseClient } from '~/server/utils/supabase'
import { getHeader } from 'h3'
import { serverSupabaseUser } from '#supabase/server'

export default defineEventHandler(async (event) => {
  const supabase = getSupabaseClient(event)

  // Optional authentication - try to get user but don't fail if not authenticated
  let user: any = null

  // Check for MCP token first
  const mcpToken = getHeader(event, 'x-mcp-token')
  if (mcpToken) {
    const { data: mcpUser } = await supabase
      .from('User')
      .select('*')
      .eq('mcp_token', mcpToken)
      .single()
    user = mcpUser
  } else {
    // Try Supabase session
    const supabaseUser = await serverSupabaseUser(event)
    if (supabaseUser) {
      const { data: appUser } = await supabase
        .from('User')
        .select('*')
        .eq('auth_user_id', supabaseUser.id)
        .single()
      user = appUser
    }
  }

  const feedId = parseInt(event.context.params?.id || '')

  if (isNaN(feedId)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid feed ID'
    })
  }

  // Build query for feed
  let feedQuery = supabase
    .from('Feed')
    .select(`
      *,
      tags:FeedTag (
        tag:Tag (
          name
        )
      )
    `)
    .eq('id', feedId)

  // Filter by user if authenticated
  if (user) {
    feedQuery = feedQuery.eq('user_id', user.id)
  }

  const { data: feed, error: feedError } = await feedQuery.single()

  if (feedError || !feed) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Feed not found'
    })
  }

  // Get unread count if authenticated
  let unreadCount = 0
  if (user) {
    const { count } = await supabase
      .from('Article')
      .select('*', { count: 'exact', head: true })
      .eq('feed_id', feedId)
      .eq('is_read', false)

    unreadCount = count || 0
  }

  return {
    id: feed.id,
    title: feed.title,
    url: feed.url,
    description: feed.description,
    siteUrl: feed.site_url,
    faviconUrl: feed.favicon_url,
    tags: feed.tags.map((ft: any) => ft.tag.name),
    unreadCount,
    lastFetchedAt: feed.last_fetched_at,
    isActive: feed.is_active,
    isAuthenticated: !!user
  }
})
