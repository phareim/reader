import OpenAI from 'openai'
import { getAuthenticatedUser } from '~/server/utils/auth'
import { getSupabaseClient } from '~/server/utils/supabase'
import { SummarizeRequest, SummarizeResponse } from '~/types/summarization'
import {
  buildSystemPrompt,
  buildUserPrompt,
  estimateTokenCount,
  calculateMaxTokens,
  formatNewsletterResponse
} from '~/server/utils/summarization'
import { Article } from '~/types'

export default defineEventHandler(async (event): Promise<SummarizeResponse> => {
  // Authenticate user
  const user = await getAuthenticatedUser(event)

  // Parse request body
  const body = await readBody<SummarizeRequest>(event)
  const {
    feedId,
    feedIds,
    tag,
    savedTag,
    isRead,
    limit = 20,
    sinceDate
  } = body

  // Validate that exactly one source is specified
  const sourceCount = [feedId, feedIds, tag, savedTag].filter(s => s !== undefined).length
  if (sourceCount === 0) {
    return {
      success: false,
      summary: '',
      error: 'Please specify one source: feedId, feedIds, tag, or savedTag',
      metadata: {
        articlesAnalyzed: 0,
        articlesIncluded: 0,
        generatedAt: new Date().toISOString(),
        model: '',
        feedTitles: [],
        tokenUsage: { input: 0, output: 0 }
      }
    }
  }

  if (sourceCount > 1) {
    return {
      success: false,
      summary: '',
      error: 'Please specify only one source: feedId, feedIds, tag, or savedTag',
      metadata: {
        articlesAnalyzed: 0,
        articlesIncluded: 0,
        generatedAt: new Date().toISOString(),
        model: '',
        feedTitles: [],
        tokenUsage: { input: 0, output: 0 }
      }
    }
  }

  // Validate limit
  const articleLimit = Math.min(Math.max(1, limit), 50)

  // Check API key
  if (!process.env.OPENAI_API_KEY) {
    return {
      success: false,
      summary: '',
      error: 'AI summarization is not configured. Please add OPENAI_API_KEY to your .env file.',
      metadata: {
        articlesAnalyzed: 0,
        articlesIncluded: 0,
        generatedAt: new Date().toISOString(),
        model: '',
        feedTitles: [],
        tokenUsage: { input: 0, output: 0 }
      }
    }
  }

  try {
    const supabase = getSupabaseClient(event)
    let articles: Article[] = []
    let sourceName = ''

    // Fetch articles based on source type
    if (feedId !== undefined) {
      // Single feed
      const parsedFeedId = Number(feedId)

      if (Number.isNaN(parsedFeedId)) {
        throw createError({
          statusCode: 400,
          statusMessage: 'Invalid feed ID'
        })
      }

      // Verify feed exists and belongs to user
      const { data: feed, error: feedError } = await supabase
        .from('Feed')
        .select('id, title')
        .eq('id', parsedFeedId)
        .eq('user_id', user.id)
        .single()

      if (feedError || !feed) {
        throw createError({
          statusCode: 404,
          statusMessage: 'Feed not found'
        })
      }

      sourceName = feed.title

      // Fetch articles from this feed
      let query = supabase
        .from('Article')
        .select(`
          *,
          feed:Feed!inner(
            title,
            favicon_url
          )
        `)
        .eq('feed_id', parsedFeedId)
        .eq('Feed.user_id', user.id)

      // Apply filters
      if (isRead !== undefined) {
        query = query.eq('is_read', isRead)
      }

      if (sinceDate) {
        query = query.gte('published_at', sinceDate)
      }

      const { data, error } = await query
        .order('published_at', { ascending: false })
        .limit(articleLimit)

      if (error) throw error

      articles = (data || []).map(transformArticle)
    } else if (feedIds !== undefined && Array.isArray(feedIds)) {
      // Multiple feeds (for tag-based)
      const parsedFeedIds = feedIds.map(id => Number(id)).filter(id => !Number.isNaN(id))

      if (parsedFeedIds.length === 0) {
        throw createError({
          statusCode: 400,
          statusMessage: 'Invalid feed IDs'
        })
      }

      // Verify feeds belong to user
      const { data: feeds, error: feedsError } = await supabase
        .from('Feed')
        .select('id, title')
        .in('id', parsedFeedIds)
        .eq('user_id', user.id)

      if (feedsError) throw feedsError

      const allowedFeedIds = feeds.map(f => f.id)

      if (allowedFeedIds.length === 0) {
        return {
          success: false,
          summary: '',
          error: 'No accessible feeds found with the specified IDs',
          metadata: {
            articlesAnalyzed: 0,
            articlesIncluded: 0,
            generatedAt: new Date().toISOString(),
            model: '',
            feedTitles: [],
            tokenUsage: { input: 0, output: 0 }
          }
        }
      }

      sourceName = `${feeds.length} feeds`

      // Fetch articles
      let query = supabase
        .from('Article')
        .select(`
          *,
          feed:Feed!inner(
            title,
            favicon_url
          )
        `)
        .in('feed_id', allowedFeedIds)
        .eq('Feed.user_id', user.id)

      if (isRead !== undefined) {
        query = query.eq('is_read', isRead)
      }

      if (sinceDate) {
        query = query.gte('published_at', sinceDate)
      }

      const { data, error } = await query
        .order('published_at', { ascending: false })
        .limit(articleLimit)

      if (error) throw error

      articles = (data || []).map(transformArticle)
    } else if (tag !== undefined) {
      // Tag-based: fetch feeds with this tag, then their articles
      const { data: feedTags, error: tagError } = await supabase
        .from('FeedTag')
        .select(`
          feed_id,
          Feed!inner(
            id,
            title,
            user_id
          ),
          Tag!inner(name)
        `)
        .eq('Tag.name', tag)
        .eq('Feed.user_id', user.id)

      if (tagError) throw tagError

      if (!feedTags || feedTags.length === 0) {
        return {
          success: false,
          summary: '',
          error: `No feeds found with tag "${tag}"`,
          metadata: {
            articlesAnalyzed: 0,
            articlesIncluded: 0,
            generatedAt: new Date().toISOString(),
            model: '',
            feedTitles: [],
            tokenUsage: { input: 0, output: 0 }
          }
        }
      }

      const tagFeedIds = feedTags.map(ft => ft.feed_id)
      sourceName = `tag: ${tag}`

      // Fetch articles from these feeds
      let query = supabase
        .from('Article')
        .select(`
          *,
          feed:Feed!inner(
            title,
            favicon_url
          )
        `)
        .in('feed_id', tagFeedIds)
        .eq('Feed.user_id', user.id)

      if (isRead !== undefined) {
        query = query.eq('is_read', isRead)
      }

      if (sinceDate) {
        query = query.gte('published_at', sinceDate)
      }

      const { data, error } = await query
        .order('published_at', { ascending: false })
        .limit(articleLimit)

      if (error) throw error

      articles = (data || []).map(transformArticle)
    } else if (savedTag !== undefined) {
      // Saved articles with tag
      let query = supabase
        .from('SavedArticle')
        .select(`
          id,
          saved_at,
          Article!inner(
            id,
            title,
            url,
            author,
            content,
            summary,
            published_at,
            is_read,
            is_starred,
            read_at,
            feed_id,
            Feed!inner(
              title,
              favicon_url
            )
          )
        `)
        .eq('user_id', user.id)

      // Filter by tag if not the special __inbox__ tag
      if (savedTag !== '__saved_untagged__') {
        const { data: savedWithTag } = await supabase
          .from('SavedArticleTag')
          .select(`
            saved_article_id,
            Tag!inner(name)
          `)
          .eq('Tag.name', savedTag)

        const savedArticleIds = savedWithTag?.map(st => st.saved_article_id) || []

        if (savedArticleIds.length === 0) {
          return {
            success: false,
            summary: '',
            error: `No saved articles found with tag "${savedTag}"`,
            metadata: {
              articlesAnalyzed: 0,
              articlesIncluded: 0,
              generatedAt: new Date().toISOString(),
              model: '',
              feedTitles: [],
              tokenUsage: { input: 0, output: 0 }
            }
          }
        }

        query = query.in('id', savedArticleIds)
      }

      const { data, error } = await query
        .order('saved_at', { ascending: false })
        .limit(articleLimit)

      if (error) throw error

      sourceName = savedTag === '__saved_untagged__' ? 'saved articles (untagged)' : `saved: ${savedTag}`

      articles = (data || []).map((sa: any) => transformArticle({
        ...sa.Article,
        feed: sa.Article.Feed
      }))
    }

    // Validate we have articles
    if (articles.length === 0) {
      return {
        success: false,
        summary: '',
        error: 'No articles found matching the specified criteria. Try adjusting filters or adding feeds.',
        metadata: {
          articlesAnalyzed: 0,
          articlesIncluded: 0,
          generatedAt: new Date().toISOString(),
          model: '',
          feedTitles: [],
          tokenUsage: { input: 0, output: 0 }
        }
      }
    }

    // Filter articles that have content
    const articlesWithContent = articles.filter(a => a.content || a.summary)

    if (articlesWithContent.length < 3) {
      return {
        success: false,
        summary: '',
        error: `Only ${articlesWithContent.length} articles have content available. At least 3 articles are needed for summarization.`,
        metadata: {
          articlesAnalyzed: articles.length,
          articlesIncluded: 0,
          generatedAt: new Date().toISOString(),
          model: '',
          feedTitles: [],
          tokenUsage: { input: 0, output: 0 }
        }
      }
    }

    // Check token estimate
    const estimatedTokens = estimateTokenCount(articlesWithContent)

    if (estimatedTokens > 150000) {
      return {
        success: false,
        summary: '',
        error: `Too many articles selected (estimated ${estimatedTokens} tokens). Please reduce limit to ${Math.floor(articlesWithContent.length * 0.6)} or fewer.`,
        metadata: {
          articlesAnalyzed: articles.length,
          articlesIncluded: articlesWithContent.length,
          generatedAt: new Date().toISOString(),
          model: '',
          feedTitles: [],
          tokenUsage: { input: 0, output: 0 }
        }
      }
    }

    // Call OpenAI API
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    })

    const maxTokens = calculateMaxTokens(articlesWithContent.length)

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',  // GPT-4o is fast and high quality
      max_tokens: maxTokens,
      messages: [
        {
          role: 'system',
          content: buildSystemPrompt()
        },
        {
          role: 'user',
          content: buildUserPrompt(articlesWithContent, sourceName)
        }
      ]
    })

    // Extract text from OpenAI response
    const summaryText = completion.choices[0]?.message?.content || ''

    // Get unique feed titles
    const feedTitles = [...new Set(articlesWithContent.map(a => a.feedTitle))]

    // Build metadata
    const metadata = {
      articlesAnalyzed: articles.length,
      articlesIncluded: articlesWithContent.length,
      generatedAt: new Date().toISOString(),
      model: completion.model,
      feedTitles,
      tokenUsage: {
        input: completion.usage?.prompt_tokens || 0,
        output: completion.usage?.completion_tokens || 0
      }
    }

    // Format final newsletter
    const newsletter = formatNewsletterResponse(summaryText, metadata)

    return {
      success: true,
      summary: newsletter,
      metadata
    }

  } catch (error: any) {
    console.error('Summarization error:', error)

    if (error.statusCode) {
      throw error
    }

    // Handle Claude API errors
    if (error.message?.includes('overloaded')) {
      return {
        success: false,
        summary: '',
        error: 'The AI service is currently overloaded. Please try again in a moment.',
        metadata: {
          articlesAnalyzed: 0,
          articlesIncluded: 0,
          generatedAt: new Date().toISOString(),
          model: '',
          feedTitles: [],
          tokenUsage: { input: 0, output: 0 }
        }
      }
    }

    return {
      success: false,
      summary: '',
      error: error.message || 'Failed to generate summary. Please try again.',
      metadata: {
        articlesAnalyzed: 0,
        articlesIncluded: 0,
        generatedAt: new Date().toISOString(),
        model: '',
        feedTitles: [],
        tokenUsage: { input: 0, output: 0 }
      }
    }
  }
})

/**
 * Transform Supabase article data to Article type
 */
function transformArticle(data: any): Article {
  return {
    id: data.id,
    feedId: data.feed_id,
    feedTitle: data.feed?.title || data.Feed?.title || '',
    feedFavicon: data.feed?.favicon_url || data.Feed?.favicon_url || null,
    guid: data.guid,
    title: data.title,
    url: data.url,
    author: data.author,
    content: data.content,
    summary: data.summary,
    publishedAt: data.published_at,
    isRead: data.is_read,
    isStarred: data.is_starred,
    readAt: data.read_at
  }
}
