import { getAuthenticatedUser } from '~/server/utils/auth'
import { getD1 } from '~/server/utils/cloudflare'
import { deleteSavedArticleNote } from '~/server/utils/article-content'

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
    const saved = await db.prepare(
      'SELECT id, note_key FROM "SavedArticle" WHERE user_id = ? AND article_id = ?'
    ).bind(user.id, articleId).first()

    if (saved?.note_key) {
      await deleteSavedArticleNote(event, saved.note_key)
    }

    await db.prepare('DELETE FROM "SavedArticle" WHERE user_id = ? AND article_id = ?')
      .bind(user.id, articleId)
      .run()

    return {
      success: true
    }
  } catch (error: any) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to unsave article',
      message: error.message
    })
  }
})
