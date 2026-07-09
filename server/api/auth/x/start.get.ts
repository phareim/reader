import { setCookie } from 'h3'
import { getSessionUser } from '~/server/utils/session'
import { isPersonalUser } from '~/server/utils/personal'
import { getXOauthConfig, pkceChallenge, randomToken, xRedirectUri, X_SCOPES } from '~/server/utils/xOauth'

/**
 * GET /api/auth/x/start — begin the link-your-X-account OAuth2 PKCE dance.
 * Browser navigation (not $fetch): stashes the verifier+state in a short-
 * lived cookie and redirects to X's authorize page; X sends the user back
 * to /api/auth/x/callback.
 *
 * Gated to NUXT_PERSONAL_EMAILS: every linked account's bookmark reads
 * bill the app owner's X API account (~$0.005/post), so guests don't get
 * the button. Widen the allowlist to open it up.
 */
export default defineEventHandler(async (event) => {
  const user = await getSessionUser(event)
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: 'Authentication required' })
  }
  if (!isPersonalUser(event, user)) {
    throw createError({ statusCode: 403, statusMessage: 'X linking is not enabled for this account' })
  }

  const { clientId } = getXOauthConfig(event)

  const state = randomToken(16)
  const verifier = randomToken(32)
  const challenge = await pkceChallenge(verifier)

  setCookie(event, 'x_oauth', JSON.stringify({ state, verifier }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax', // the callback is a top-level navigation, so lax cookies ride along
    maxAge: 600,
    path: '/api/auth/x',
  })

  const authorize = new URL('https://x.com/i/oauth2/authorize')
  authorize.search = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: xRedirectUri(event),
    scope: X_SCOPES,
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
  }).toString()

  return sendRedirect(event, authorize.toString())
})
