import { getAuthenticatedUser } from '~/server/utils/auth'
import { getD1 } from '~/server/utils/cloudflare'
import { deleteStoredObjects } from '~/server/utils/article-content'
import { deleteFtsRows } from '~/server/utils/searchIndex'

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

    // One statement for the feed's saved-article notes and batched R2
    // deletes. A round trip per article (a SELECT plus an R2 delete each) ran
    // a feed of ~500 articles past the invocation's 1000-subrequest cap: the
    // delete failed halfway, with bodies gone and the feed still there.
    const notesResult = await db.prepare(
      `SELECT sa.note_key
       FROM "SavedArticle" sa
       JOIN "Article" a ON a.id = sa.article_id
       WHERE a.feed_id = ? AND sa.note_key IS NOT NULL`
    ).bind(id).all()

    await deleteStoredObjects(event, [
      ...(notesResult.results || []).map((row: any) => row.note_key),
      ...(articlesResult.results || []).map((article: any) => article.content_key)
    ])

    // FTS rows don't cascade with the article delete below.
    await deleteFtsRows(event, (articlesResult.results || []).map((a: any) => Number(a.id)))

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
