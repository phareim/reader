/**
 * DELETE /api/articles/:id
 * Delete an article entirely (only for manually added articles)
 * This is different from unsaving - this actually deletes the article
 */

import { getAuthenticatedUser } from '~/server/utils/auth'
import { getD1 } from '~/server/utils/cloudflare'
import { deleteArticleContent, deleteSavedArticleNote } from '~/server/utils/article-content'

export default defineEventHandler(async (event) => {
  const user = await getAuthenticatedUser(event)
  const db = getD1(event)

  const articleId = parseInt(getRouterParam(event, 'id') || '')
  if (isNaN(articleId)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid article ID'
    })
  }

  try {
    // Get the article with its feed
    const article = await db.prepare(
      `
      SELECT a.id, a.content_key, f.user_id, f.title AS feed_title
      FROM "Article" a
      JOIN "Feed" f ON f.id = a.feed_id
      WHERE a.id = ?
      `
    ).bind(articleId).first()

    if (!article) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Article not found'
      })
    }

    // Verify the article belongs to the user's feed
    if (article.user_id !== user.id) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Forbidden'
      })
    }

    // Only allow deletion of manually added articles (from Manual Additions feed)
    if (article.feed_title !== 'Manual Additions') {
      throw createError({
        statusCode: 400,
        statusMessage: 'Can only delete manually added articles',
        message: 'Regular feed articles cannot be deleted. You can unsave them instead.'
      })
    }

    const savedNotes = await db.prepare(
      'SELECT note_key FROM "SavedArticle" WHERE article_id = ?'
    ).bind(articleId).all()

    for (const row of savedNotes.results || []) {
      await deleteSavedArticleNote(event, row.note_key)
    }

    await deleteArticleContent(event, article.content_key)
    await db.prepare('DELETE FROM "Article" WHERE id = ?').bind(articleId).run()

    return {
      success: true,
      message: 'Article deleted successfully'
    }
  } catch (error: any) {
    if (error.statusCode) {
      throw error
    }

    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to delete article',
      message: error.message
    })
  }
})
