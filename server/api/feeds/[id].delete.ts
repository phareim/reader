import { getAuthenticatedUser } from '~/server/utils/auth'
import { getD1 } from '~/server/utils/cloudflare'
import { deleteArticleContent, deleteSavedArticleNote } from '~/server/utils/article-content'

export default defineEventHandler(async (event) => {
  const user = await getAuthenticatedUser(event)
  const db = getD1(event)

  const id = parseInt(getRouterParam(event, 'id') || '')

  if (isNaN(id)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid feed ID'
    })
  }

  try {
    const feed = await db.prepare(
      'SELECT id FROM "Feed" WHERE id = ? AND user_id = ?'
    ).bind(id, user.id).first()

    if (!feed) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Feed not found'
      })
    }

    const articlesResult = await db.prepare(
      'SELECT id, content_key FROM "Article" WHERE feed_id = ?'
    ).bind(id).all()

    const articleCount = articlesResult.results?.length || 0
    for (const article of articlesResult.results || []) {
      const notesResult = await db.prepare(
        'SELECT note_key FROM "SavedArticle" WHERE article_id = ?'
      ).bind(article.id).all()

      for (const row of notesResult.results || []) {
        await deleteSavedArticleNote(event, row.note_key)
      }

      await deleteArticleContent(event, article.content_key)
    }

    await db.prepare('DELETE FROM "Feed" WHERE id = ?').bind(id).run()

    return {
      success: true,
      deletedArticles: articleCount || 0
    }
  } catch (error: any) {
    // If it's already a createError, rethrow it
    if (error.statusCode) {
      throw error
    }

    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to delete feed',
      message: error.message
    })
  }
})
