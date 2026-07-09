import { getSessionUser } from '~/server/utils/session'
import { getD1 } from '~/server/utils/cloudflare'

/**
 * GET /api/auth/x/link — the Sources page's status probe for the
 * link-your-X-account block. `available` is false only while the OAuth
 * client isn't configured, so the UI can hide the whole section; linking
 * itself is open to every signed-in user (see start.get.ts).
 */
export default defineEventHandler(async (event) => {
  const user = await getSessionUser(event)
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: 'Authentication required' })
  }

  const config = useRuntimeConfig(event)
  const available = !!config.xClientId && !!config.xClientSecret
  if (!available) {
    return { available: false, linked: false }
  }

  const row = await getD1(event).prepare(
    `SELECT handle, last_sync_at, last_error FROM "XAccount" WHERE user_id = ?`
  ).bind(user.id).first<{ handle: string | null; last_sync_at: string | null; last_error: string | null }>()

  return {
    available: true,
    linked: !!row,
    handle: row?.handle ?? null,
    lastSyncAt: row?.last_sync_at ?? null,
    lastError: row?.last_error ?? null,
  }
})
