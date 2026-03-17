import { getAuthenticatedUser } from '~/server/utils/auth'
import { getD1, getAI } from '~/server/utils/cloudflare'
import { fetchArticleContent } from '~/server/utils/article-content'
import { buildFlowingSummaryPrompt } from '~/server/utils/tag-summary'

export default defineEventHandler(async (event) => {
  const user = await getAuthenticatedUser(event)
  const tagName = decodeURIComponent(event.context.params?.name || '')

  if (!tagName) {
    throw createError({ statusCode: 400, statusMessage: 'Tag name is required' })
  }

  const body = await readBody(event)
  const limit = Math.min(Math.max(1, Number(body?.limit) || 20), 30)

  const db = getD1(event)
  const ai = getAI(event)

  // Get feed IDs for this tag
  const tagFeeds = await db.prepare(
    `SELECT ft.feed_id
     FROM "FeedTag" ft
     JOIN "Tag" t ON t.id = ft.tag_id
     WHERE t.user_id = ? AND t.name = ?`
  ).bind(user.id, tagName).all()

  const feedIds = (tagFeeds.results || []).map((row: any) => row.feed_id)
  if (feedIds.length === 0) {
    return { success: false, error: `No feeds found with tag "${tagName}"`, summary: '', articleIds: [] }
  }

  // Get unread articles for those feeds
  const placeholders = feedIds.map(() => '?').join(',')
  const articlesResult = await db.prepare(
    `SELECT a.id, a.title, a.url, a.author, a.summary, a.content_key, a.published_at,
            f.title AS feed_title
     FROM "Article" a
     JOIN "Feed" f ON f.id = a.feed_id
     WHERE a.feed_id IN (${placeholders})
       AND a.is_read = 0
     ORDER BY a.published_at DESC
     LIMIT ?`
  ).bind(...feedIds, limit).all()

  const rows = articlesResult.results || []

  if (rows.length === 0) {
    return { success: false, error: 'No unread articles found for this tag.', summary: '', articleIds: [] }
  }

  // Inflate articles with R2 content
  const articles = await Promise.all(rows.map(async (row: any) => {
    const content = await fetchArticleContent(event, row.content_key)
    return {
      id: row.id as number,
      title: row.title as string,
      url: row.url as string,
      content: content || (row.summary as string | null),
      summary: row.summary as string | null,
      feedTitle: row.feed_title as string
    }
  }))

  const articlesWithContent = articles.filter(a => a.content || a.summary)
  if (articlesWithContent.length === 0) {
    return { success: false, error: 'No articles with content available for summarization.', summary: '', articleIds: [] }
  }

  try {
    const { system, user: userPrompt } = buildFlowingSummaryPrompt(articlesWithContent)

    const result = await ai.run('@cf/meta/llama-3.3-70b-instruct-fp8-fast', {
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: userPrompt }
      ],
      max_tokens: 2048
    })

    const summary = result.response || result.result || ''

    return {
      success: true,
      summary,
      articleIds: articles.map(a => a.id),
      metadata: {
        articlesCount: articlesWithContent.length,
        generatedAt: new Date().toISOString(),
        model: '@cf/meta/llama-3.3-70b-instruct-fp8-fast'
      }
    }
  } catch (err: any) {
    console.error('Workers AI error:', err)

    // Fallback to smaller model
    try {
      const { system, user: userPrompt } = buildFlowingSummaryPrompt(articlesWithContent)

      const result = await ai.run('@cf/meta/llama-3.1-8b-instruct', {
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: userPrompt }
        ],
        max_tokens: 2048
      })

      const summary = result.response || result.result || ''

      return {
        success: true,
        summary,
        articleIds: articles.map(a => a.id),
        metadata: {
          articlesCount: articlesWithContent.length,
          generatedAt: new Date().toISOString(),
          model: '@cf/meta/llama-3.1-8b-instruct (fallback)'
        }
      }
    } catch (fallbackErr: any) {
      console.error('Fallback AI error:', fallbackErr)
      return {
        success: false,
        error: `AI summarization failed: ${err.message}`,
        summary: '',
        articleIds: []
      }
    }
  }
})
