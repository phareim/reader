import { H3Event } from 'h3'

/**
 * X (Twitter) OAuth2 client for the link-your-X-account flow and the
 * Worker-side bookmark sync. Standard authorization-code + PKCE against
 * api.x.com with a confidential client (Basic auth on the token endpoint).
 *
 * IMPORTANT: X ROTATES the refresh token on every refresh. Whoever calls
 * refreshXToken must persist the returned pair immediately, and nothing
 * else may refresh the same token — the internal sync endpoint is the
 * single owner (the old Sleeper-side collector must stay retired).
 */

export const X_SCOPES = 'bookmark.read tweet.read users.read offline.access'
const TOKEN_URL = 'https://api.x.com/2/oauth2/token'
const REVOKE_URL = 'https://api.x.com/2/oauth2/revoke'

export type XTokenSet = {
  access_token: string
  refresh_token: string
  expires_in: number
  obtained_at: number // unix seconds
}

export function getXOauthConfig(event: H3Event) {
  const config = useRuntimeConfig(event)
  const clientId = config.xClientId
  const clientSecret = config.xClientSecret
  if (!clientId || !clientSecret) {
    throw createError({ statusCode: 503, statusMessage: 'X linking is not configured' })
  }
  return { clientId, clientSecret }
}

const b64url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

export function randomToken(bytes = 32): string {
  const buf = new Uint8Array(bytes)
  crypto.getRandomValues(buf)
  return b64url(buf)
}

export async function pkceChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))
  return b64url(new Uint8Array(digest))
}

async function tokenRequest(
  event: H3Event,
  params: Record<string, string>
): Promise<XTokenSet & { ok: boolean; error?: string }> {
  const { clientId, clientSecret } = getXOauthConfig(event)
  const basic = btoa(`${clientId}:${clientSecret}`)
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams(params),
    signal: AbortSignal.timeout(10_000),
  })
  const j: any = await res.json().catch(() => ({}))
  if (!res.ok || !j.access_token) {
    return { ok: false, error: `X token endpoint ${res.status}: ${JSON.stringify(j).slice(0, 300)}` } as any
  }
  return {
    ok: true,
    access_token: j.access_token,
    // Some responses omit the refresh token; the caller keeps the prior one then.
    refresh_token: j.refresh_token || params.refresh_token,
    expires_in: j.expires_in || 7200,
    obtained_at: Math.floor(Date.now() / 1000),
  }
}

export async function exchangeXCode(
  event: H3Event,
  code: string,
  verifier: string,
  redirectUri: string
) {
  return tokenRequest(event, {
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
    code_verifier: verifier,
  })
}

export async function refreshXToken(event: H3Event, refreshToken: string) {
  return tokenRequest(event, {
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  })
}

/** Best-effort revoke on unlink — a failure here never blocks the unlink. */
export async function revokeXToken(event: H3Event, token: string): Promise<void> {
  try {
    const { clientId, clientSecret } = getXOauthConfig(event)
    const basic = btoa(`${clientId}:${clientSecret}`)
    await fetch(REVOKE_URL, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basic}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ token, token_type_hint: 'refresh_token' }),
      signal: AbortSignal.timeout(10_000),
    })
  } catch {
    // best effort
  }
}

/** The OAuth callback URL for this deployment, derived from the request. */
export function xRedirectUri(event: H3Event): string {
  return `${getRequestURL(event).origin}/api/auth/x/callback`
}
