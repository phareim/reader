import { getCookie, deleteCookie, getQuery } from 'h3'
import { getSessionUser } from '~/server/utils/session'
import { exchangeRedditCode, redditRedirectUri, REDDIT_UA } from '~/server/utils/redditOauth'
import { upsertLinkedSource } from '~/server/utils/linkedSources'

/**
 * GET /api/auth/reddit/callback — lands here from Reddit's authorize page.
 * Verifies state against the reddit_oauth cookie, exchanges the code,
 * resolves the username via /api/v1/me, and upserts the LinkedSource row.
 * Always redirects back to /sources with ?linked=reddit|?error=reddit.
 */
export default defineEventHandler(async (event) => {
  const back = (q: string) => sendRedirect(event, `/sources?${q}`)

  const user = await getSessionUser(event)
  if (!user) return sendRedirect(event, '/login?redirect=/sources')

  const q = getQuery(event)
  const cookieRaw = getCookie(event, 'reddit_oauth')
  deleteCookie(event, 'reddit_oauth', { path: '/api/auth/reddit' })

  if (q.error || !q.code) return back('error=reddit') // user denied, or Reddit errored

  let stash: { state?: string } = {}
  try {
    stash = JSON.parse(cookieRaw || '{}')
  } catch {}
  if (!stash.state || stash.state !== q.state) {
    console.error('Reddit callback: state mismatch or missing cookie')
    return back('error=reddit')
  }

  try {
    const token = await exchangeRedditCode(event, String(q.code), redditRedirectUri(event))
    if (!token.ok) {
      console.error('Reddit callback:', token.error)
      return back('error=reddit')
    }

    const meRes = await fetch('https://oauth.reddit.com/api/v1/me', {
      headers: { Authorization: `Bearer ${token.access_token}`, 'User-Agent': REDDIT_UA },
      signal: AbortSignal.timeout(10_000),
    })
    const me: any = await meRes.json().catch(() => ({}))
    if (!meRes.ok || !me.name) {
      console.error('Reddit callback: /api/v1/me failed', meRes.status)
      return back('error=reddit')
    }

    await upsertLinkedSource(event, {
      userId: user.id,
      source: 'reddit',
      externalId: me.name, // the saved listing is fetched by username
      handle: me.name,
      credentials: {
        access_token: token.access_token,
        refresh_token: token.refresh_token,
        obtained_at: token.obtained_at,
        expires_in: token.expires_in,
      },
    })

    return back('linked=reddit')
  } catch (error: any) {
    console.error('Reddit callback failed:', error)
    return back('error=reddit')
  }
})
