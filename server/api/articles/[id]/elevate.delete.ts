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

  // Query params, not readBody: Nitro's cloudflare-module entry never buffers
  // DELETE bodies (its method regex is /post|put|patch/i), so reading one on
  // the deployed Worker throws an unhandled exception (Cloudflare 1101).
  const query = getQuery(event)
  const body = {
    ideaId: typeof query.ideaId === 'string' ? query.ideaId : undefined,
    existing: query.existing === 'true',
  }

  const db = getD1(event)
  const article = await db.prepare(
    `
    SELECT a.id
    FROM "Article" a
    JOIN "Feed" f ON f.id = a.feed_id
    WHERE a.id = ? AND f.user_id = ?
    `
  ).bind(articleId, user.id).first()

  if (!article) {
    throw createError({ statusCode: 404, statusMessage: 'Article not found' })
  }

  if (body?.ideaId && !body.existing) {
    // The client-supplied ideaId is trusted because this is a single-user stack
    // behind reader auth; if multi-user ever lands, verify the idea's URL
    // matches the article before deleting.
    await deleteIdea(getSflConfig(event), body.ideaId)
  }

  // Mirrors read.patch.ts: clear the flag and the read_at timestamp.
  await db.prepare(
    `UPDATE "Article" SET is_read = 0, read_at = NULL WHERE id = ?`
  ).bind(articleId).run()

  return { success: true }
})
