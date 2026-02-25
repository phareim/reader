import OpenAI from 'openai'
import { getAuthenticatedUser } from '~/server/utils/auth'
import { getD1 } from '~/server/utils/cloudflare'
import { fetchArticleContent } from '~/server/utils/article-content'
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
  const user = await getAuthenticatedUser(event)

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

  const sourceCount = [feedId, feedIds, tag, savedTag].filter(s => s !== undefined).length
  if (sourceCount === 0) {
    return emptyError('Please specify one source: feedId, feedIds, tag, or savedTag')
  }

  if (sourceCount > 1) {
    return emptyError('Please specify only one source: feedId, feedIds, tag, or savedTag')
  }

  const articleLimit = Math.min(Math.max(1, limit), 50)

  if (!process.env.OPENAI_API_KEY) {
    return emptyError('AI summarization is not configured. Please add OPENAI_API_KEY to your .env file.')
  }

  try {
    const db = getD1(event)
    let articles: Article[] = []
    let sourceName = ''

    if (feedId !== undefined) {
      const parsedFeedId = Number(feedId)
      if (Number.isNaN(parsedFeedId)) {
        throw createError({ statusCode: 400, statusMessage: 'Invalid feed ID' })
      }

      const feed = await db.prepare(
        'SELECT id, title FROM "Feed" WHERE id = ? AND user_id = ?'
      ).bind(parsedFeedId, user.id).first()

      if (!feed) {
        throw createError({ statusCode: 404, statusMessage: 'Feed not found' })
      }

      sourceName = feed.title
      const rows = await fetchArticlesByFeedIds(db, [parsedFeedId], user.id, isRead, sinceDate, articleLimit)
      articles = await inflateArticles(event, rows)
    } else if (feedIds !== undefined && Array.isArray(feedIds)) {
      const parsedFeedIds = feedIds.map(id => Number(id)).filter(id => !Number.isNaN(id))
      if (parsedFeedIds.length === 0) {
        throw createError({ statusCode: 400, statusMessage: 'Invalid feed IDs' })
      }

      const placeholders = parsedFeedIds.map(() => '?').join(',')
      const feedsResult = await db.prepare(
        `SELECT id, title FROM "Feed" WHERE user_id = ? AND id IN (${placeholders})`
      ).bind(user.id, ...parsedFeedIds).all()

      const allowedFeedIds = (feedsResult.results || []).map((f: any) => f.id)
      if (allowedFeedIds.length === 0) {
        return emptyError('No accessible feeds found with the specified IDs')
      }

      sourceName = `${feedsResult.results?.length || 0} feeds`
      const rows = await fetchArticlesByFeedIds(db, allowedFeedIds, user.id, isRead, sinceDate, articleLimit)
      articles = await inflateArticles(event, rows)
    } else if (tag !== undefined) {
      const tagFeeds = await db.prepare(
        `
        SELECT ft.feed_id
        FROM "FeedTag" ft
        JOIN "Tag" t ON t.id = ft.tag_id
        WHERE t.user_id = ? AND t.name = ?
        `
      ).bind(user.id, tag).all()

      const tagFeedIds = (tagFeeds.results || []).map((row: any) => row.feed_id)
      if (tagFeedIds.length === 0) {
        return emptyError(`No feeds found with tag "${tag}"`)
      }

      sourceName = `tag: ${tag}`
      const rows = await fetchArticlesByFeedIds(db, tagFeedIds, user.id, isRead, sinceDate, articleLimit)
      articles = await inflateArticles(event, rows)
    } else if (savedTag !== undefined) {
      const params: any[] = [user.id]
      let where = 'sa.user_id = ?'
      if (savedTag !== '__saved_untagged__') {
        where += ` AND EXISTS (
          SELECT 1
          FROM "SavedArticleTag" sat2
          JOIN "Tag" t2 ON t2.id = sat2.tag_id
          WHERE sat2.saved_article_id = sa.id AND t2.name = ?
        )`
        params.push(savedTag)
      } else {
        where += ' AND NOT EXISTS (SELECT 1 FROM "SavedArticleTag" sat2 WHERE sat2.saved_article_id = sa.id)'
      }

      const savedRows = await db.prepare(
        `
        SELECT
          a.id,
          a.feed_id,
          a.guid,
          a.title,
          a.url,
          a.author,
          a.summary,
          a.content_key,
          a.published_at,
          a.is_read,
          a.is_starred,
          a.read_at,
          f.title AS feed_title,
          f.favicon_url AS feed_favicon
        FROM "SavedArticle" sa
        JOIN "Article" a ON a.id = sa.article_id
        JOIN "Feed" f ON f.id = a.feed_id
        WHERE ${where}
        ORDER BY sa.saved_at DESC
        LIMIT ?
        `
      ).bind(...params, articleLimit).all()

      sourceName = savedTag === '__saved_untagged__' ? 'saved articles (untagged)' : `saved: ${savedTag}`
      articles = await inflateArticles(event, savedRows.results || [])
    }

    if (articles.length === 0) {
      return emptyError('No articles found matching the specified criteria. Try adjusting filters or adding feeds.')
    }

    const articlesWithContent = articles.filter(a => a.content || a.summary)

    if (articlesWithContent.length < 3) {
      return emptyError(`Only ${articlesWithContent.length} articles have content available. At least 3 articles are needed for summarization.`, {
        articlesAnalyzed: articles.length,
        articlesIncluded: 0
      })
    }

    const estimatedTokens = estimateTokenCount(articlesWithContent)

    if (estimatedTokens > 150000) {
      return emptyError(`Too many articles selected (estimated ${estimatedTokens} tokens). Please reduce limit to ${Math.floor(articlesWithContent.length * 0.6)} or fewer.`, {
        articlesAnalyzed: articles.length,
        articlesIncluded: articlesWithContent.length
      })
    }

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    })

    const maxTokens = calculateMaxTokens(articlesWithContent.length)

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      max_tokens: maxTokens,
      messages: [
        { role: 'system', content: buildSystemPrompt() },
        { role: 'user', content: buildUserPrompt(articlesWithContent, sourceName) }
      ]
    })

    const summaryText = completion.choices[0]?.message?.content || ''
    const feedTitles = [...new Set(articlesWithContent.map(a => a.feedTitle))]

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

    if (error.message?.includes('overloaded')) {
      return emptyError('The AI service is currently overloaded. Please try again in a moment.')
    }

    return emptyError(error.message || 'Failed to generate summary. Please try again.')
  }
})

const emptyError = (message: string, overrides?: { articlesAnalyzed?: number; articlesIncluded?: number }) => ({
  success: false,
  summary: '',
  error: message,
  metadata: {
    articlesAnalyzed: overrides?.articlesAnalyzed ?? 0,
    articlesIncluded: overrides?.articlesIncluded ?? 0,
    generatedAt: new Date().toISOString(),
    model: '',
    feedTitles: [],
    tokenUsage: { input: 0, output: 0 }
  }
})

const fetchArticlesByFeedIds = async (
  db: any,
  feedIds: number[],
  userId: string,
  isRead: boolean | undefined,
  sinceDate: string | undefined,
  limit: number
) => {
  const params: any[] = [...feedIds, userId]
  let where = `a.feed_id IN (${feedIds.map(() => '?').join(',')}) AND f.user_id = ?`

  if (isRead !== undefined) {
    where += ' AND a.is_read = ?'
    params.push(isRead ? 1 : 0)
  }

  if (sinceDate) {
    where += ' AND a.published_at >= ?'
    params.push(sinceDate)
  }

  return await db.prepare(
    `
    SELECT
      a.id,
      a.feed_id,
      a.guid,
      a.title,
      a.url,
      a.author,
      a.summary,
      a.content_key,
      a.published_at,
      a.is_read,
      a.is_starred,
      a.read_at,
      f.title AS feed_title,
      f.favicon_url AS feed_favicon
    FROM "Article" a
    JOIN "Feed" f ON f.id = a.feed_id
    WHERE ${where}
    ORDER BY a.published_at DESC
    LIMIT ?
    `
  ).bind(...params, limit).all().then((r: any) => r.results || [])
}

const inflateArticles = async (event: any, rows: any[]) => {
  return await Promise.all(rows.map(async (row) => {
    const content = await fetchArticleContent(event, row.content_key)
    return transformArticle({ ...row, content })
  }))
}

const transformArticle = (data: any): Article => ({
  id: data.id,
  feedId: data.feed_id,
  feedTitle: data.feed_title || '',
  feedFavicon: data.feed_favicon || null,
  guid: data.guid,
  title: data.title,
  url: data.url,
  author: data.author,
  content: data.content,
  summary: data.summary,
  publishedAt: data.published_at,
  isRead: Boolean(data.is_read),
  isStarred: Boolean(data.is_starred),
  readAt: data.read_at
})
