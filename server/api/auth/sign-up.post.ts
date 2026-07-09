import { getD1 } from '~/server/utils/cloudflare'
import { hashPassword } from '~/server/utils/password'
import { createSession } from '~/server/utils/session'
import { toPublicUser } from '~/server/utils/auth'
import { checkPassword } from '~/server/utils/passwordPolicy'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { email, password, name, inviteCode } = body || {}

  // Sign-up is invite-only: without a configured code it is closed, and the
  // client must send the matching code. This also guards the claim branch
  // below (password-less legacy accounts).
  const config = useRuntimeConfig(event)
  if (!config.inviteCode) {
    throw createError({ statusCode: 403, statusMessage: 'Sign-ups are closed' })
  }
  if (typeof inviteCode !== 'string' || inviteCode.trim() !== config.inviteCode) {
    throw createError({ statusCode: 403, statusMessage: 'Invalid invite code' })
  }

  if (!email || !password) {
    throw createError({ statusCode: 400, statusMessage: 'Email and password are required' })
  }

  const policy = checkPassword(password)
  if (!policy.ok) {
    throw createError({ statusCode: 400, statusMessage: policy.reason })
  }

  const db = getD1(event)
  const passwordHash = await hashPassword(password)

  // Check if user already exists (e.g., migrated from Google OAuth)
  const existing = await db.prepare('SELECT * FROM "User" WHERE email = ?').bind(email).first() as any

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
