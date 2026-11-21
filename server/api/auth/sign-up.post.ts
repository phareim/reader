import { getD1 } from '~/server/utils/cloudflare'
import { requireJson } from '~/server/utils/requireJson'
import { hashPassword } from '~/server/utils/password'
import { createSession } from '~/server/utils/session'
import { toPublicUser } from '~/server/utils/auth'
import { checkPassword } from '~/server/utils/passwordPolicy'
import { assertNotRateLimited, recordFailedAttempt } from '~/server/utils/authRateLimit'

export default defineEventHandler(async (event) => {
  requireJson(event)
  const body = await readBody(event)
  const { password, name, inviteCode } = body || {}
  // Trimmed before it is looked up or stored; a non-string is a 400.
  const email = typeof body?.email === 'string' ? body.email.trim() : ''

  // Sign-up is invite-only: without a configured code it is closed, and the
  // client must send the matching code. This also guards the claim branch
  // below (password-less legacy accounts).
  const config = useRuntimeConfig(event)
  if (!config.inviteCode) {
    throw createError({ statusCode: 403, statusMessage: 'Sign-ups are closed' })
  }

  if (!email || !password) {
    throw createError({ statusCode: 400, statusMessage: 'Email and password are required' })
  }

  // Wrong invite codes count against the same per-email window as failed
  // sign-ins (auth_attempt), so the code cannot be guessed at full speed.
  const db = getD1(event)
  await assertNotRateLimited(event, db, email)

  // Case-insensitive, so "Ulrikke" on a phone keyboard still counts.
  if (typeof inviteCode !== 'string'
    || inviteCode.trim().toLowerCase() !== String(config.inviteCode).trim().toLowerCase()) {
    await recordFailedAttempt(event, db, email)
    throw createError({ statusCode: 403, statusMessage: 'Invalid invite code' })
  }

  const policy = checkPassword(password)
  if (!policy.ok) {
    throw createError({ statusCode: 400, statusMessage: policy.reason })
  }

  const passwordHash = await hashPassword(password)

  // Check if user already exists (e.g., migrated from Google OAuth)
  const existing = await db.prepare('SELECT * FROM "User" WHERE email = ?').bind(email).first() as any

  // Emails are stored as typed and compared exactly, but the allowlisted apps
  // compare them lowercased: a case variant of an existing address
  // (Petter@… for petter@…) would pass their allowlist as a new account.
  if (!existing) {
    const variant = await db.prepare('SELECT id FROM "User" WHERE lower(email) = lower(?)').bind(email).first()
    if (variant) {
      throw createError({ statusCode: 409, statusMessage: 'An account with this email already exists. Please sign in.' })
    }
  }

  if (existing) {
    if (existing.password_hash) {
      throw createError({ statusCode: 409, statusMessage: 'An account with this email already exists. Please sign in.' })
    }

    // Existing user without password — set their password (migration from OAuth)
    await db.prepare(
      'UPDATE "User" SET password_hash = ? WHERE id = ?'
    ).bind(passwordHash, existing.id).run()

    await createSession(event, existing.id)
    return { user: toPublicUser(existing) }
  }

  // New user
  const id = crypto.randomUUID()
  const displayName = name || email.split('@')[0]
  await db.prepare(
    'INSERT INTO "User" (id, name, email, password_hash) VALUES (?, ?, ?, ?)'
  ).bind(id, displayName, email, passwordHash).run()

  await createSession(event, id)
  return { user: toPublicUser({ id, email, name: displayName }) }
})
