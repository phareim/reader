import { getAuthenticatedUser } from '~/server/utils/auth'
import { getSupabaseClient } from '~/server/utils/supabase'

export default defineEventHandler(async (event) => {
  // Optional authentication - public read access allowed for specific feeds
  const user = await getAuthenticatedUser(event)

  const query = getQuery(event)

  const feedIdParam = query.feedId as string | undefined
  const feedIdsParam = query.feedIds as string | undefined
  const isRead = query.isRead === 'true' ? true : query.isRead === 'false' ? false : undefined
  const isStarred = query.isStarred === 'true' ? true : undefined
  const excludeSaved = query.excludeSaved === 'true'
  const limit = Math.min(parseInt(query.limit as string) || 50, 200)
  const offset = parseInt(query.offset as string) || 0

  try {
    const supabase = getSupabaseClient(event)

    // Build the query dynamically
    let articlesQuery = supabase
      .from('Article')
      .select(`
        *,
        feed:Feed!inner(
          title,
          favicon_url
        )
      `, { count: 'exact' })

    // Handle single feedId
    if (feedIdParam !== undefined) {
      const parsedFeedId = Number(feedIdParam)

      if (Number.isNaN(parsedFeedId)) {
        throw createError({
          statusCode: 400,
          statusMessage: 'Invalid feed ID'
        })
      }

      // Check if feed exists and user has access
      const { data: feed, error: feedError } = await supabase
        .from('Feed')
        .select('id')
        .eq('id', parsedFeedId)
        .eq('user_id', user.id)
        .single()

      if (feedError || !feed) {
        throw createError({
          statusCode: 404,
          statusMessage: 'Feed not found'
        })
      }

      articlesQuery = articlesQuery.eq('feed_id', parsedFeedId)
    }
    // Handle multiple feedIds
    else if (feedIdsParam) {
      const requestedFeedIds = feedIdsParam
        .split(',')
        .map(id => Number(id.trim()))
        .filter(id => !Number.isNaN(id))

      if (requestedFeedIds.length === 0) {
        throw createError({
          statusCode: 400,
          statusMessage: 'Invalid feed IDs'
        })
      }

      // Get allowed feeds for this user
      const { data: feeds, error: feedsError } = await supabase
        .from('Feed')
        .select('id')
        .in('id', requestedFeedIds)
        .eq('user_id', user.id)

      if (feedsError) {
        throw feedsError
      }

      const allowedFeedIds = feeds.map(feed => feed.id)

      if (allowedFeedIds.length === 0) {
        return {
          articles: [],
          total: 0,
          hasMore: false
        }
      }

      articlesQuery = articlesQuery.in('feed_id', allowedFeedIds)
    }
    // No specific feed - filter by user's feeds
    else if (user) {
      articlesQuery = articlesQuery.eq('Feed.user_id', user.id)
    }

    // Apply personal filters (only when authenticated)
    if (user) {
      if (isRead !== undefined) {
        articlesQuery = articlesQuery.eq('is_read', isRead)
      }

      if (isStarred !== undefined) {
        articlesQuery = articlesQuery.eq('is_starred', isStarred)
      }

      if (excludeSaved) {
        // Get saved article IDs for this user
        const { data: savedArticles } = await supabase
          .from('SavedArticle')
          .select('article_id')
          .eq('user_id', user.id)

        const savedArticleIds = savedArticles?.map(sa => sa.article_id) || []

        if (savedArticleIds.length > 0) {
          articlesQuery = articlesQuery.not('id', 'in', `(${savedArticleIds.join(',')})`)
        }
      }
    }

    // Execute query with pagination
    const { data: articles, count, error } = await articlesQuery
      .order('published_at', { ascending: false, nullsFirst: false })
      .range(offset, offset + limit - 1)

    if (error) {
      throw error
    }

    return {
      articles: (articles || []).map(article => ({
        id: article.id,
        feedId: article.feed_id,
        feedTitle: article.feed.title,
        feedFavicon: article.feed.favicon_url,
        guid: article.guid,
        title: article.title,
        url: article.url,
        author: article.author,
        content: article.content,
        summary: article.summary,
        imageUrl: article.image_url,
        publishedAt: article.published_at,
        isRead: article.is_read,
        isStarred: article.is_starred,
        readAt: article.read_at
      })),
      total: count || 0,
      hasMore: offset + (articles?.length || 0) < (count || 0)
    }
  } catch (error: any) {
    if (error.statusCode) {
      throw error
    }

    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to fetch articles',
      message: error.message
    })
  }
})
