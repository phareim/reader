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

  const articleId = parseInt(event.context.params?.id || '')

  if (isNaN(articleId)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid article ID'
    })
  }

  // Build query for article with feed details
  let articleQuery = supabase
    .from('Article')
    .select(`
      *,
      feed:Feed!inner (
        id,
        title,
        favicon_url,
        user_id
      )
    `)
    .eq('id', articleId)

  // Filter by user if authenticated
  if (user) {
    articleQuery = articleQuery.eq('Feed.user_id', user.id)
  }

  const { data: article, error: articleError } = await articleQuery.single()

  if (articleError || !article) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Article not found'
    })
  }

  // If authenticated, fetch saved article info
  let savedArticle: any = null
  let savedTags: string[] = []

  if (user) {
    const { data: saved } = await supabase
      .from('SavedArticle')
      .select(`
        id,
        saved_at,
        tags:SavedArticleTag (
          tag:Tag (
            name
          )
        )
      `)
      .eq('user_id', user.id)
      .eq('article_id', articleId)
      .single()

    if (saved) {
      savedArticle = saved
      savedTags = saved.tags.map((t: any) => t.tag.name)
    }
  }

  return {
    id: article.id,
    title: article.title,
    url: article.url,
    content: article.content,
    summary: article.summary,
    author: article.author,
    publishedAt: article.published_at,
    // Personal data only if authenticated
    isRead: user ? article.is_read : false,
    readAt: user ? article.read_at : null,
    feedId: article.feed_id,
    feedTitle: article.feed.title,
    feedFaviconUrl: article.feed.favicon_url,
    savedId: savedArticle?.id,
    tags: savedTags,
    // Indicate if user is authenticated (for UI purposes)
    isAuthenticated: !!user
  }
})
