/**
 * Minimal cookie-based session management.
 * Sessions are stored in the D1 "session" table and referenced by a token cookie.
 */

import { H3Event, getCookie, setCookie, deleteCookie } from 'h3'
import { getD1 } from '~/server/utils/cloudflare'
import { toHex } from '~/server/utils/password'

const SESSION_COOKIE = 'session_token'
const SESSION_MAX_AGE = 30 * 24 * 60 * 60 // 30 days in seconds

function generateToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  return toHex(bytes.buffer as ArrayBuffer)
}

export async function createSession(event: H3Event, userId: string): Promise<string> {
  const db = getD1(event)
  const token = generateToken()
  const id = generateToken().substring(0, 24)
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE * 1000).toISOString()

  await db.prepare(
    'INSERT INTO "session" (id, user_id, token, expires_at) VALUES (?, ?, ?, ?)'
  ).bind(id, userId, token, expiresAt).run()

  setCookie(event, SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_MAX_AGE,
    path: '/',
  })

  return token
}

export async function getSessionUser(event: H3Event): Promise<any | null> {
  const token = getCookie(event, SESSION_COOKIE)
  if (!token) return null

  const db = getD1(event)
  const user = await db.prepare(
    'SELECT u.* FROM "session" s JOIN "User" u ON u.id = s.user_id WHERE s.token = ? AND s.expires_at > ?'
  ).bind(token, new Date().toISOString()).first()

  if (!user) {
    // Clean up if session exists but expired
    await db.prepare('DELETE FROM "session" WHERE token = ? AND expires_at <= ?')
      .bind(token, new Date().toISOString()).run()
    return null
  }

  return user
}

export async function destroySession(event: H3Event): Promise<void> {
  const token = getCookie(event, SESSION_COOKIE)
  if (token) {
    const db = getD1(event)
    await db.prepare('DELETE FROM "session" WHERE token = ?').bind(token).run()
  }
  deleteCookie(event, SESSION_COOKIE, { path: '/' })
}
