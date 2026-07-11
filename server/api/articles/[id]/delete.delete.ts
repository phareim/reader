/**
 * DELETE /api/articles/:id
 * Delete an article entirely (manual additions and Found cards only —
 * regular RSS articles would just be re-synced, so they can't be deleted).
 * This is different from unsaving - this actually deletes the article
 */

import { getAuthenticatedUser } from '~/server/utils/auth'
import { getD1 } from '~/server/utils/cloudflare'
import { deleteArticleContent, deleteSavedArticleNote } from '~/server/utils/article-content'
import { deleteFtsRows } from '~/server/utils/searchIndex'

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
      SELECT a.id, a.content_key, f.user_id, f.title AS feed_title, f.kind AS feed_kind
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

    // Only manual additions and Found cards may be deleted. The Manual
    // Additions feed predates Feed.kind, so it is matched by title too.
    const deletable =
      article.feed_kind === 'found' ||
      article.feed_kind === 'manual' ||
      article.feed_title === 'Manual Additions'
    if (!deletable) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Can only delete manual or Found articles',
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
    await deleteFtsRows(event, [articleId])
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
