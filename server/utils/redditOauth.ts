import { H3Event } from 'h3'
import type { OauthCredentials } from '~/server/utils/linkedSources'

/**
 * Reddit OAuth2 client for the link-your-Reddit-account flow and the
 * Worker-side saved-items sync. Standard authorization-code flow (no PKCE —
 * Reddit doesn't support it; the state cookie is the CSRF guard) with
 * `duration=permanent` so we get a refresh token. Reddit ROTATES refresh
 * tokens on refresh like X does — persist the returned pair immediately,
 * and only the internal sync endpoint may refresh.
 *
 * Reddit REQUIRES a descriptive User-Agent on every call (token endpoint
 * included) or it 429s aggressively.
 */

export const REDDIT_SCOPES = 'history identity'
export const REDDIT_UA = 'web:no.phareim.reader:v1.0 (by /u/phareim)'
const TOKEN_URL = 'https://www.reddit.com/api/v1/access_token'

export function getRedditOauthConfig(event: H3Event) {
  const config = useRuntimeConfig(event)
  const clientId = config.redditClientId
  const clientSecret = config.redditClientSecret
  if (!clientId || !clientSecret) {
    throw createError({ statusCode: 503, statusMessage: 'Reddit linking is not configured' })
  }
  return { clientId, clientSecret }
}

async function tokenRequest(
  event: H3Event,
  params: Record<string, string>
): Promise<(OauthCredentials & { ok: true }) | { ok: false; error: string }> {
  const { clientId, clientSecret } = getRedditOauthConfig(event)
  const basic = btoa(`${clientId}:${clientSecret}`)
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': REDDIT_UA,
    },
    body: new URLSearchParams(params),
    signal: AbortSignal.timeout(10_000),
  })
  const j: any = await res.json().catch(() => ({}))
  if (!res.ok || !j.access_token) {
    return { ok: false, error: `Reddit token endpoint ${res.status}: ${JSON.stringify(j).slice(0, 300)}` }
  }
  return {
    ok: true,
    access_token: j.access_token,
    // Rotation: a refresh response carries a new refresh token; keep the
    // prior one if a response ever omits it.
    refresh_token: j.refresh_token || params.refresh_token,
    expires_in: j.expires_in || 3600,
    obtained_at: Math.floor(Date.now() / 1000),
  }
}

export async function exchangeRedditCode(event: H3Event, code: string, redirectUri: string) {
  return tokenRequest(event, {
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
  })
}

export async function refreshRedditToken(event: H3Event, refreshToken: string) {
  return tokenRequest(event, {
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  })
}

/** Best-effort revoke on unlink — a failure here never blocks the unlink. */
export async function revokeRedditToken(event: H3Event, refreshToken: string): Promise<void> {
  try {
    const { clientId, clientSecret } = getRedditOauthConfig(event)
    const basic = btoa(`${clientId}:${clientSecret}`)
    await fetch('https://www.reddit.com/api/v1/revoke_token', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basic}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': REDDIT_UA,
      },
      body: new URLSearchParams({ token: refreshToken, token_type_hint: 'refresh_token' }),
      signal: AbortSignal.timeout(10_000),
    })
  } catch {
    // best effort
  }
}

export function redditRedirectUri(event: H3Event): string {
  return `${getRequestURL(event).origin}/api/auth/reddit/callback`
}
