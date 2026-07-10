import { getSessionUser } from '~/server/utils/session'
import { upsertLinkedSource } from '~/server/utils/linkedSources'
import { z } from 'zod'

/**
 * POST /api/sources/links/hackernews — link a Hacker News account by
 * username. Favorites are public, so there is no OAuth: we just validate
 * the user exists via the official Firebase API and store the name. The
 * sync then scrapes news.ycombinator.com/favorites?id=<name>.
 */
const bodySchema = z.object({
  username: z.string().trim().min(2).max(60).regex(/^[A-Za-z0-9_-]+$/, 'Invalid HN username'),
})

export default defineEventHandler(async (event) => {
  const user = await getSessionUser(event)
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: 'Authentication required' })
  }

  const parsed = bodySchema.safeParse(await readBody(event))
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid username' })
  }
  const username = parsed.data.username

  const res = await fetch(`https://hacker-news.firebaseio.com/v0/user/${username}.json`, {
    signal: AbortSignal.timeout(10_000),
  })
  const profile: any = res.ok ? await res.json().catch(() => null) : null
  if (!profile?.id) {
    throw createError({ statusCode: 404, statusMessage: 'No such Hacker News user' })
  }

  await upsertLinkedSource(event, {
    userId: user.id,
    source: 'hackernews',
    externalId: profile.id, // canonical casing from the API
    handle: profile.id,
    credentials: null,
  })

  return { success: true, handle: profile.id }
})
