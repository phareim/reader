import { getAuthenticatedUser } from '~/server/utils/auth'
import { getD1 } from '~/server/utils/cloudflare'
import { getSflConfig, deleteIdea } from '~/server/utils/sfl'

/**
 * Delete a highlight: remove the local row and, when the mark created an SFL
 * quote idea, delete that idea too (tolerates 404). No request body — the id
 * is in the path (Nitro's cloudflare-module entry drops DELETE bodies).
 */
export default defineEventHandler(async (event) => {
  const user = await getAuthenticatedUser(event)

  const highlightId = parseInt(getRouterParam(event, 'id') || '')
  if (isNaN(highlightId)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid highlight ID' })
  }

  const db = getD1(event)
  const highlight = await db.prepare(
    `SELECT id, sfl_idea_id FROM "Highlight" WHERE id = ? AND user_id = ?`
  ).bind(highlightId, user.id).first<{ id: number; sfl_idea_id: string | null }>()

  if (!highlight) {
    throw createError({ statusCode: 404, statusMessage: 'Highlight not found' })
  }

  if (highlight.sfl_idea_id) {
    // Fail soft if SFL is unconfigured — still drop the local row.
    try {
      await deleteIdea(getSflConfig(event), highlight.sfl_idea_id)
    } catch (err: any) {
      if (err?.statusCode !== 503) throw err
    }
  }

  await db.prepare(`DELETE FROM "Highlight" WHERE id = ?`).bind(highlightId).run()

  return { success: true }
})
