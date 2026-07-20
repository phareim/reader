import { getD1 } from '~/server/utils/cloudflare'
import { fetchArticleContent, fetchSavedArticleNote } from '~/server/utils/article-content'
import { getAuthenticatedUser } from '~/server/utils/auth'

export default defineEventHandler(async (event) => {
  const db = getD1(event)
  const user = await getAuthenticatedUser(event)

  const articleId = parseInt(event.context.params?.id || '')

  if (isNaN(articleId)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid article ID'
    })
  }

  // One D1 round trip for all four queries, then the R2 reads in parallel —
  // run sequentially these hops dominated the endpoint's latency.
  const [articleResult, savedResult, tagsResult, goodReadResult] = await db.batch([
    db.prepare(
      `
      SELECT
        a.*,
        f.id AS feed_id,
        f.title AS feed_title,
        f.favicon_url AS feed_favicon_url,
        f.user_id AS feed_user_id,
        f.kind AS feed_kind
      FROM "Article" a
      JOIN "Feed" f ON f.id = a.feed_id
      WHERE a.id = ?
      `
    ).bind(articleId),
    db.prepare(
      `
      SELECT id, saved_at, note_key
      FROM "SavedArticle"
      WHERE user_id = ? AND article_id = ?
      `
    ).bind(user.id, articleId),
    db.prepare(
      `
      SELECT t.name
      FROM "SavedArticleTag" sat
      JOIN "SavedArticle" sa ON sa.id = sat.saved_article_id
      JOIN "Tag" t ON t.id = sat.tag_id
      WHERE sa.user_id = ? AND sa.article_id = ?
      `
    ).bind(user.id, articleId),
    db.prepare(
      'SELECT id FROM "GoodRead" WHERE user_id = ? AND article_id = ?'
    ).bind(user.id, articleId)
  ])

  const article: any = articleResult.results?.[0]

  if (!article || article.feed_user_id !== user.id) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Article not found'
    })
  }

  const savedArticle: any = savedResult.results?.[0] ?? null
  const savedTags = (tagsResult.results || []).map((row: any) => row.name)
  const goodRead = goodReadResult.results?.[0]

  const [content, note] = await Promise.all([
    fetchArticleContent(event, article.content_key),
    savedArticle ? fetchSavedArticleNote(event, savedArticle.note_key) : null
  ])

  return {
    id: article.id,
    title: article.title,
    url: article.url,
    content,
    summary: article.summary,
    imageUrl: article.image_url,
    author: article.author,
    publishedAt: article.published_at,
    isRead: user ? Boolean(article.is_read) : false,
    readAt: user ? article.read_at : null,
    readProgress: article.read_progress ?? 0,
    fullTextStatus: article.full_text_status,
    feedId: article.feed_id,
    feedTitle: article.feed_title,
    feedKind: article.feed_kind,
    feedFaviconUrl: article.feed_favicon_url,
    savedId: savedArticle?.id,
    isGoodRead: !!goodRead,
    note,
    tags: savedTags,
    isAuthenticated: !!user
  }
})
