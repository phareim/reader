import { getCookie, deleteCookie, getQuery } from 'h3'
import { getSessionUser } from '~/server/utils/session'
import { exchangeXCode, xRedirectUri } from '~/server/utils/xOauth'
import { upsertLinkedSource } from '~/server/utils/linkedSources'

/**
 * GET /api/auth/x/callback — lands here from X's authorize page.
 * Verifies state against the x_oauth cookie, exchanges the code (PKCE),
 * resolves the X handle via users/me, and upserts the LinkedSource row.
 * Always redirects back to /sources with ?linked=x|?error=x so the page
 * can toast; errors never strand the user on a JSON page.
 */
export default defineEventHandler(async (event) => {
  const back = (q: string) => sendRedirect(event, `/sources?${q}`)

  const user = await getSessionUser(event)
  if (!user) return sendRedirect(event, '/login?redirect=/sources')

  const q = getQuery(event)
  const cookieRaw = getCookie(event, 'x_oauth')
  deleteCookie(event, 'x_oauth', { path: '/api/auth/x' })

  if (q.error || !q.code) return back('error=x') // user denied, or X errored

  let stash: { state?: string; verifier?: string } = {}
  try {
    stash = JSON.parse(cookieRaw || '{}')
  } catch {}
  if (!stash.state || !stash.verifier || stash.state !== q.state) {
    console.error('X callback: state mismatch or missing PKCE cookie')
    return back('error=x')
  }

  try {
    const token = await exchangeXCode(event, String(q.code), stash.verifier, xRedirectUri(event))
    if (!token.ok) {
      console.error('X callback:', token.error)
      return back('error=x')
    }

    const meRes = await fetch('https://api.x.com/2/users/me', {
      headers: { Authorization: `Bearer ${token.access_token}` },
      signal: AbortSignal.timeout(10_000),
    })
    const me: any = await meRes.json().catch(() => ({}))
    if (!meRes.ok || !me.data?.id) {
      console.error('X callback: users/me failed', meRes.status)
      return back('error=x')
    }

    await upsertLinkedSource(event, {
      userId: user.id,
      source: 'x',
      externalId: me.data.id,
      handle: me.data.username || null,
      credentials: {
        access_token: token.access_token,
        refresh_token: token.refresh_token,
        obtained_at: token.obtained_at,
        expires_in: token.expires_in,
      },
    })

    return back('linked=x')
  } catch (error: any) {
    console.error('X callback failed:', error)
    return back('error=x')
  }
})
