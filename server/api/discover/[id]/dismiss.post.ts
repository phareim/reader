import { getAuthenticatedUser } from '~/server/utils/auth'
import { getD1 } from '~/server/utils/cloudflare'
import { rowsChanged } from '~/server/utils/d1Result'

/**
 * The Dismiss verb on a /discover row. 'dismissed' is terminal — the row
 * is kept forever as the dedupe fence, so a re-crawl never resurrects it.
 */
export default defineEventHandler(async (event) => {
  const user = await getAuthenticatedUser(event)
  const candidateId = parseInt(getRouterParam(event, 'id') || '')
  if (isNaN(candidateId)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid candidate ID' })
  }

  const db = getD1(event)
  const result = await db.prepare(
    `
    UPDATE "DiscoverCandidate"
    SET status = 'dismissed', updated_at = ?
    WHERE id = ? AND user_id = ? AND status = 'candidate'
    `
  ).bind(new Date().toISOString(), candidateId, user.id).run()

  if (rowsChanged(result) === 0) {
    throw createError({ statusCode: 404, statusMessage: 'Candidate not found' })
  }

  return { ok: true }
})
