import { setCookie } from 'h3'
import { getSessionUser } from '~/server/utils/session'
import { getRedditOauthConfig, redditRedirectUri, REDDIT_SCOPES } from '~/server/utils/redditOauth'
import { randomToken } from '~/server/utils/xOauth'

/**
 * GET /api/auth/reddit/start — begin the link-your-Reddit-account OAuth2
 * dance (browser navigation, not $fetch). Reddit has no PKCE; the state
 * cookie is the CSRF guard. `duration=permanent` yields a refresh token so
 * the sync can run unattended. Open to every signed-in user (Reddit's API
 * is free — no billing concern, unlike X).
 */
export default defineEventHandler(async (event) => {
  const user = await getSessionUser(event)
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: 'Authentication required' })
  }

  const { clientId } = getRedditOauthConfig(event)

  const state = randomToken(16)
  setCookie(event, 'reddit_oauth', JSON.stringify({ state }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax', // the callback is a top-level navigation, so lax cookies ride along
    maxAge: 600,
    path: '/api/auth/reddit',
  })

  const authorize = new URL('https://www.reddit.com/api/v1/authorize')
  authorize.search = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    state,
    redirect_uri: redditRedirectUri(event),
    duration: 'permanent',
    scope: REDDIT_SCOPES,
  }).toString()

  return sendRedirect(event, authorize.toString())
})
