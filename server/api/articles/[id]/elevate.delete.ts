import { getAuthenticatedUser } from '~/server/utils/auth'
import { getD1 } from '~/server/utils/cloudflare'
import { getSflConfig, deleteIdea } from '~/server/utils/sfl'

/**
 * Undo an elevate: delete the SFL idea that the elevate created (only when
 * it actually created one — `existing` ideas predate the elevate and are
 * not ours to delete) and mark the article unread.
 */
export default defineEventHandler(async (event) => {
  const user = await getAuthenticatedUser(event)

  const articleId = parseInt(getRouterParam(event, 'id') || '')
  if (isNaN(articleId)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid article ID' })
  }

  const db = getD1(event)
  const article = await db.prepare(
    `
    SELECT a.id, a.sfl_idea_id
    FROM "Article" a
    JOIN "Feed" f ON f.id = a.feed_id
    WHERE a.id = ? AND f.user_id = ?
    `
  ).bind(articleId, user.id).first<{ id: number; sfl_idea_id: string | null }>()

  if (!article) {
    throw createError({ statusCode: 404, statusMessage: 'Article not found' })
  }

  // Delete the idea recorded server-side by the elevate, never a client-supplied
  // id. It is only ever set when the elevate created the idea (SFL !existing), so
  // its mere presence means it is ours to delete — no trust of the caller needed.
  if (article.sfl_idea_id) {
    await deleteIdea(getSflConfig(event), article.sfl_idea_id)
  }

  // Mirrors read.patch.ts: clear the flag and the read_at timestamp, and drop
  // the idea link now that it is gone.
  await db.prepare(
    `UPDATE "Article" SET is_read = 0, read_at = NULL, sfl_idea_id = NULL WHERE id = ?`
  ).bind(articleId).run()

  return { success: true }
})
