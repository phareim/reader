import { getSessionUser } from '~/server/utils/session'
import { getD1 } from '~/server/utils/cloudflare'
import { revokeXToken } from '~/server/utils/xOauth'

/**
 * DELETE /api/auth/x/link — unlink the caller's X account. Best-effort
 * revokes the refresh token upstream, then drops the row. Already-ingested
 * Found articles stay; only future syncs stop.
 */
export default defineEventHandler(async (event) => {
  const user = await getSessionUser(event)
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: 'Authentication required' })
  }

  const db = getD1(event)
  const row = await db.prepare(
    `SELECT refresh_token FROM "XAccount" WHERE user_id = ?`
  ).bind(user.id).first<{ refresh_token: string }>()

  if (row?.refresh_token) {
    await revokeXToken(event, row.refresh_token)
  }

  await db.prepare(`DELETE FROM "XAccount" WHERE user_id = ?`).bind(user.id).run()

  return { success: true }
})
