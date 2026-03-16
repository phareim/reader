import { getD1 } from '~/server/utils/cloudflare'
import { fetchArticleContent, fetchSavedArticleNote } from '~/server/utils/article-content'
import { getOptionalUser } from '~/server/utils/auth'

export default defineEventHandler(async (event) => {
  const db = getD1(event)
  const user = await getOptionalUser(event)

  const articleId = parseInt(event.context.params?.id || '')

  if (isNaN(articleId)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid article ID'
    })
  }

  const article = await db.prepare(
    `
    SELECT
      a.*,
      f.id AS feed_id,
      f.title AS feed_title,
      f.favicon_url AS feed_favicon_url,
      f.user_id AS feed_user_id
    FROM "Article" a
    JOIN "Feed" f ON f.id = a.feed_id
    WHERE a.id = ?
    `
  ).bind(articleId).first()

  if (!article || (user && article.feed_user_id !== user.id)) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Article not found'
    })
  }

  // If authenticated, fetch saved article info
  let savedArticle: any = null
  let savedTags: string[] = []

  if (user) {
    const saved = await db.prepare(
      `
      SELECT id, saved_at, note_key
      FROM "SavedArticle"
      WHERE user_id = ? AND article_id = ?
      `
    ).bind(user.id, articleId).first()

    if (saved) {
      savedArticle = saved
      const tagsResult = await db.prepare(
        `
        SELECT t.name
        FROM "SavedArticleTag" sat
        JOIN "Tag" t ON t.id = sat.tag_id
        WHERE sat.saved_article_id = ?
        `
      ).bind(saved.id).all()
      savedTags = (tagsResult.results || []).map((row: any) => row.name)
    }
  }

  const content = await fetchArticleContent(event, article.content_key)
  const note = savedArticle ? await fetchSavedArticleNote(event, savedArticle.note_key) : null

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
    feedId: article.feed_id,
    feedTitle: article.feed_title,
    feedFaviconUrl: article.feed_favicon_url,
    savedId: savedArticle?.id,
    note,
    tags: savedTags,
    isAuthenticated: !!user
  }
})
