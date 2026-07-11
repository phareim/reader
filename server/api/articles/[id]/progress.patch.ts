/**
 * PATCH /api/articles/:id/progress
 * Save the reading position — how far down the article the reader is, as a
 * fraction of scrollable height (0..1). The reader saves it debounced while
 * scrolling and restores it when the article is reopened.
 */

import { getAuthenticatedUser } from '~/server/utils/auth'
import { getD1 } from '~/server/utils/cloudflare'
import { rowsChanged } from '~/server/utils/d1Result'

export default defineEventHandler(async (event) => {
  const user = await getAuthenticatedUser(event)

  const id = parseInt(getRouterParam(event, 'id') || '')
  if (isNaN(id)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid article ID'
    })
  }

  const body = await readBody(event)
  const progress = Number(body?.progress)
  if (!Number.isFinite(progress)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'progress must be a number'
    })
  }
  const clamped = Math.min(1, Math.max(0, progress))

  try {
    const db = getD1(event)
    const result = await db.prepare(
      `
      UPDATE "Article"
      SET read_progress = ?1, progress_updated_at = ?2
      WHERE id = ?3
        AND feed_id IN (SELECT id FROM "Feed" WHERE user_id = ?4)
      `
    ).bind(clamped, new Date().toISOString(), id, user.id).run()

    if (!rowsChanged(result)) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Article not found'
      })
    }

    return { success: true, progress: clamped }
  } catch (error: any) {
    if (error.statusCode) {
      throw error
    }

    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to save reading position',
      message: error.message
    })
  }
})
