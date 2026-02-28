import { getHeader } from 'h3'
import { getD1 } from '~/server/utils/cloudflare'

export default defineEventHandler(async (event) => {
  const db = getD1(event)

  // Optional authentication - try to get user but don't fail if not authenticated
  let user: any = null

  // Check for MCP token first
  const mcpToken = getHeader(event, 'x-mcp-token')
  if (mcpToken) {
    user = await db.prepare('SELECT * FROM "User" WHERE mcp_token = ?')
      .bind(mcpToken)
      .first()
  } else {
    // Try nuxt-auth-utils session
    const session = await getUserSession(event)
    if (session?.user?.email) {
      user = await db.prepare('SELECT * FROM "User" WHERE email = ?')
        .bind(session.user.email)
        .first()
    }
  }

  const feedId = parseInt(event.context.params?.id || '')

  if (isNaN(feedId)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid feed ID'
    })
  }

  const feed = await db.prepare(
    `
    SELECT *
    FROM "Feed"
    WHERE id = ?
    `
  ).bind(feedId).first()

  if (!feed || (user && feed.user_id !== user.id)) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Feed not found'
    })
  }

  const tagsResult = await db.prepare(
    `
    SELECT t.name
    FROM "FeedTag" ft
    JOIN "Tag" t ON t.id = ft.tag_id
    WHERE ft.feed_id = ?
    `
  ).bind(feedId).all()

  let unreadCount = 0
  if (user) {
    const countResult = await db.prepare(
      `
      SELECT COUNT(*) AS total
      FROM "Article"
      WHERE feed_id = ? AND is_read = 0
      `
    ).bind(feedId).first()
    unreadCount = Number(countResult?.total || 0)
  }

  return {
    id: feed.id,
    title: feed.title,
    url: feed.url,
    description: feed.description,
    siteUrl: feed.site_url,
    faviconUrl: feed.favicon_url,
    tags: (tagsResult.results || []).map((row: any) => row.name).sort(),
    unreadCount,
    lastFetchedAt: feed.last_fetched_at,
    isActive: Boolean(feed.is_active),
    isAuthenticated: !!user
  }
})
