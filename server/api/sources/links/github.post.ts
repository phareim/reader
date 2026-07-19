import { getSessionUser } from '~/server/utils/session'
import { upsertLinkedSource } from '~/server/utils/linkedSources'
import { GITHUB_UA } from '~/server/utils/githubStars'
import { z } from 'zod'

/**
 * POST /api/sources/links/github — link a GitHub account by username.
 * Stars are public, so there is no OAuth: we just validate the user
 * exists via the REST API and store the login. The sync then pages
 * api.github.com/users/<login>/starred.
 */
const bodySchema = z.object({
  username: z.string().trim().min(1).max(60).regex(/^[A-Za-z0-9-]+$/, 'Invalid GitHub username'),
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

  const res = await fetch(`https://api.github.com/users/${username}`, {
    headers: { 'User-Agent': GITHUB_UA, Accept: 'application/vnd.github+json' },
    signal: AbortSignal.timeout(10_000),
  })
  const profile: any = res.ok ? await res.json().catch(() => null) : null
  if (!profile?.login) {
    throw createError({ statusCode: 404, statusMessage: 'No such GitHub user' })
  }

  await upsertLinkedSource(event, {
    userId: user.id,
    source: 'github',
    externalId: profile.login, // canonical casing from the API
    handle: profile.login,
    credentials: null,
  })

  return { success: true, handle: profile.login }
})
