import { getAuthenticatedUser } from '~/server/utils/auth'
import { getSupabaseClient } from '~/server/utils/supabase'

export default defineEventHandler(async (event) => {
  // Get authenticated user (supports both session and MCP token)
  const user = await getAuthenticatedUser(event)

  try {
    const supabase = getSupabaseClient(event)

    // Get optional tag filter from query params
    const query = getQuery(event)
    const tagFilter = query.tag as string | undefined

    // Build base query
    let savedArticlesQuery = supabase
      .from('SavedArticle')
      .select(`
        *,
        article:Article!inner(
          *,
          feed:Feed!inner(*)
        ),
        tags:SavedArticleTag(
          tag:Tag(name)
        )
      `)
      .eq('user_id', user.id)
      .order('saved_at', { ascending: false })

    // Apply tag filter if provided
    if (tagFilter) {
      if (tagFilter === '__inbox__') {
        // Special case: show untagged saved articles
        // We need to fetch all and filter client-side or use a different approach
        const { data: savedArticles, error } = await savedArticlesQuery

        if (error) {
          throw error
        }

        // Filter for articles with no tags
        const untaggedArticles = (savedArticles || []).filter(sa => sa.tags.length === 0)

        return {
          articles: untaggedArticles.map(saved => ({
            id: saved.article.id,
            feedId: saved.article.feed_id,
            feedTitle: saved.article.feed.title,
            title: saved.article.title,
            url: saved.article.url,
            author: saved.article.author,
            content: saved.article.content,
            summary: saved.article.summary,
            imageUrl: saved.article.image_url,
            publishedAt: saved.article.published_at,
            isRead: saved.article.is_read,
            savedAt: saved.saved_at,
            savedId: saved.id,
            tags: []
          }))
        }
      } else {
        // Filter by specific tag - need to do client-side filtering
        const { data: savedArticles, error } = await savedArticlesQuery

        if (error) {
          throw error
        }

        // Filter for articles with the specific tag
        const filteredArticles = (savedArticles || []).filter(sa =>
          sa.tags.some(t => t.tag.name === tagFilter)
        )

        return {
          articles: filteredArticles.map(saved => ({
            id: saved.article.id,
            feedId: saved.article.feed_id,
            feedTitle: saved.article.feed.title,
            title: saved.article.title,
            url: saved.article.url,
            author: saved.article.author,
            content: saved.article.content,
            summary: saved.article.summary,
            imageUrl: saved.article.image_url,
            publishedAt: saved.article.published_at,
            isRead: saved.article.is_read,
            savedAt: saved.saved_at,
            savedId: saved.id,
            tags: saved.tags.map(sat => sat.tag.name)
          }))
        }
      }
    }

    // No tag filter - return all saved articles
    const { data: savedArticles, error } = await savedArticlesQuery

    if (error) {
      throw error
    }

    return {
      articles: (savedArticles || []).map(saved => ({
        id: saved.article.id,
        feedId: saved.article.feed_id,
        feedTitle: saved.article.feed.title,
        title: saved.article.title,
        url: saved.article.url,
        author: saved.article.author,
        content: saved.article.content,
        summary: saved.article.summary,
        imageUrl: saved.article.image_url,
        publishedAt: saved.article.published_at,
        isRead: saved.article.is_read,
        savedAt: saved.saved_at,
        savedId: saved.id,
        tags: saved.tags.map(sat => sat.tag.name)
      }))
    }
  } catch (error: any) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to fetch saved articles',
      message: error.message
    })
  }
})
