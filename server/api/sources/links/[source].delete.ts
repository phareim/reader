import { getSessionUser } from '~/server/utils/session'
import {
  getLinkedSource,
  deleteLinkedSource,
  parseCredentials,
  SOURCE_KEYS,
  type SourceKey,
} from '~/server/utils/linkedSources'
import { revokeXToken } from '~/server/utils/xOauth'
import { revokeRedditToken } from '~/server/utils/redditOauth'

/**
 * DELETE /api/sources/links/:source — unlink one source. Best-effort
 * revokes OAuth tokens upstream, then drops the row. Already-ingested
 * Found articles stay; only future syncs stop.
 */
export default defineEventHandler(async (event) => {
  const user = await getSessionUser(event)
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: 'Authentication required' })
  }

  const source = getRouterParam(event, 'source') as SourceKey
  if (!SOURCE_KEYS.includes(source)) {
    throw createError({ statusCode: 404, statusMessage: 'Unknown source' })
  }

  const row = await getLinkedSource(event, user.id, source)
  const creds = row ? parseCredentials(row) : null
  if (creds?.refresh_token) {
    if (source === 'x') await revokeXToken(event, creds.refresh_token)
    if (source === 'reddit') await revokeRedditToken(event, creds.refresh_token)
  }

  await deleteLinkedSource(event, user.id, source)
  return { success: true }
})
