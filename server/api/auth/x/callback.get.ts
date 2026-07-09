import { getCookie, deleteCookie, getQuery } from 'h3'
import { getSessionUser } from '~/server/utils/session'
import { getD1 } from '~/server/utils/cloudflare'
import { exchangeXCode, xRedirectUri } from '~/server/utils/xOauth'

/**
 * GET /api/auth/x/callback — lands here from X's authorize page.
 * Verifies state against the x_oauth cookie, exchanges the code (PKCE),
 * resolves the X handle via users/me, and upserts the XAccount row.
 * Always redirects back to /sources with ?x=linked|error so the page can
 * toast; errors never strand the user on a JSON page.
 */
export default defineEventHandler(async (event) => {
  const back = (result: string) => sendRedirect(event, `/sources?x=${result}`)

  const user = await getSessionUser(event)
  if (!user) return sendRedirect(event, '/login?redirect=/sources')

  const q = getQuery(event)
  const cookieRaw = getCookie(event, 'x_oauth')
  deleteCookie(event, 'x_oauth', { path: '/api/auth/x' })

  if (q.error || !q.code) return back('error') // user denied, or X errored

  let stash: { state?: string; verifier?: string } = {}
  try {
    stash = JSON.parse(cookieRaw || '{}')
  } catch {}
  if (!stash.state || !stash.verifier || stash.state !== q.state) {
    console.error('X callback: state mismatch or missing PKCE cookie')
    return back('error')
  }

  try {
    const token = await exchangeXCode(event, String(q.code), stash.verifier, xRedirectUri(event))
    if (!token.ok) {
      console.error('X callback:', token.error)
      return back('error')
    }

    const meRes = await fetch('https://api.x.com/2/users/me', {
      headers: { Authorization: `Bearer ${token.access_token}` },
      signal: AbortSignal.timeout(10_000),
    })
    const me: any = await meRes.json().catch(() => ({}))
    if (!meRes.ok || !me.data?.id) {
      console.error('X callback: users/me failed', meRes.status)
      return back('error')
    }

    const db = getD1(event)
    await db.prepare(
      `
      INSERT INTO "XAccount" (user_id, x_user_id, handle, access_token, refresh_token, obtained_at, expires_in, last_error)
      VALUES (?, ?, ?, ?, ?, ?, ?, NULL)
      ON CONFLICT(user_id) DO UPDATE SET
        x_user_id = excluded.x_user_id,
        handle = excluded.handle,
        access_token = excluded.access_token,
        refresh_token = excluded.refresh_token,
        obtained_at = excluded.obtained_at,
        expires_in = excluded.expires_in,
        last_error = NULL
      `
    ).bind(
      user.id,
      me.data.id,
      me.data.username || null,
      token.access_token,
      token.refresh_token,
      token.obtained_at,
      token.expires_in
    ).run()

    return back('linked')
  } catch (error: any) {
    console.error('X callback failed:', error)
    return back('error')
  }
})
