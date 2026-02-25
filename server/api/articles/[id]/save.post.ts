import { getAuthenticatedUser } from '~/server/utils/auth'
import { getD1 } from '~/server/utils/cloudflare'

export default defineEventHandler(async (event) => {
  // Get authenticated user (supports both session and MCP token)
  const user = await getAuthenticatedUser(event)

  // Get article ID from route params
  const articleId = parseInt(getRouterParam(event, 'id') || '')
  if (isNaN(articleId)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid article ID'
    })
  }

  try {
    const db = getD1(event)
    const article = await db.prepare(
      `
      SELECT a.id, a.feed_id
      FROM "Article" a
      JOIN "Feed" f ON f.id = a.feed_id
      WHERE a.id = ? AND f.user_id = ?
      `
    ).bind(articleId, user.id).first()

    if (!article) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Article not found'
      })
    }

    const feedTagsResult = await db.prepare(
      `
      SELECT t.id, t.name
      FROM "FeedTag" ft
      JOIN "Tag" t ON t.id = ft.tag_id
      WHERE ft.feed_id = ? AND t.user_id = ?
      `
    ).bind(article.feed_id, user.id).all()

    const now = new Date().toISOString()
    const insertResult = await db.prepare(
      `
      INSERT OR IGNORE INTO "SavedArticle" (user_id, article_id, saved_at)
      VALUES (?, ?, ?)
      `
    ).bind(user.id, articleId, now).run()

    const savedArticle = await db.prepare(
      `
      SELECT id, saved_at
      FROM "SavedArticle"
      WHERE user_id = ? AND article_id = ?
      `
    ).bind(user.id, articleId).first()

    if (!savedArticle) {
      throw createError({
        statusCode: 500,
        message: 'Failed to save article'
      })
    }

    for (const tag of feedTagsResult.results || []) {
      await db.prepare(
        `
        INSERT OR IGNORE INTO "SavedArticleTag" (saved_article_id, tag_id, tagged_at)
        VALUES (?, ?, ?)
        `
      ).bind(savedArticle.id, tag.id, now).run()
    }

    return {
      success: true,
      savedArticle: {
        id: savedArticle.id,
        articleId: articleId,
        savedAt: savedArticle.saved_at
      }
    }
  } catch (error: any) {
    if (error.statusCode) {
      throw error
    }

    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to save article',
      message: error.message
    })
  }
})
