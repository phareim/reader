/**
 * DELETE /api/tags/[id]
 * Delete a tag (and all its associations)
 */

import { getAuthenticatedUser } from '~/server/utils/auth'
import { getD1 } from '~/server/utils/cloudflare'

export default defineEventHandler(async (event) => {
  const user = await getAuthenticatedUser(event)
  const db = getD1(event)

  const tagId = parseInt(event.context.params?.id || '')
  if (isNaN(tagId)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid tag ID'
    })
  }

  const existingTag = await db.prepare(
    'SELECT id FROM "Tag" WHERE id = ? AND user_id = ?'
  ).bind(tagId, user.id).first()

  if (!existingTag) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Tag not found'
    })
  }

  await db.prepare('DELETE FROM "Tag" WHERE id = ? AND user_id = ?')
    .bind(tagId, user.id)
    .run()

  return { success: true }
})
