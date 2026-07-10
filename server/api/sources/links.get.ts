import { getSessionUser } from '~/server/utils/session'
import { listLinkedSources, SOURCE_KEYS } from '~/server/utils/linkedSources'

/**
 * GET /api/sources/links — the Sources page's status probe for the
 * "Linked sources" section. One entry per known source; `available` is
 * false while that source's client isn't configured (OAuth sources) so
 * the UI can hide its row. Hacker News needs no credentials and is
 * always available.
 */
export default defineEventHandler(async (event) => {
  const user = await getSessionUser(event)
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: 'Authentication required' })
  }

  const config = useRuntimeConfig(event)
  const availability: Record<string, boolean> = {
    x: !!config.xClientId && !!config.xClientSecret,
    reddit: !!config.redditClientId && !!config.redditClientSecret,
    hackernews: true,
  }

  const rows = await listLinkedSources(event, user.id)
  const bySource = new Map(rows.map((r) => [r.source, r]))

  return {
    sources: SOURCE_KEYS.map((source) => {
      const row = bySource.get(source)
      return {
        source,
        available: availability[source],
        linked: !!row,
        handle: row?.handle ?? null,
        lastSyncAt: row?.last_sync_at ?? null,
        lastError: row?.last_error ?? null,
      }
    }),
  }
})
