import { getD1 } from '~/server/utils/cloudflare'
import { hashPassword } from '~/server/utils/password'
import { createSession } from '~/server/utils/session'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { email, password, name } = body || {}

  if (!email || !password) {
    throw createError({ statusCode: 400, statusMessage: 'Email and password are required' })
  }

  if (typeof password !== 'string' || password.length < 8) {
    throw createError({ statusCode: 400, statusMessage: 'Password must be at least 8 characters' })
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
    return { user: { id: existing.id, email: existing.email, name: existing.name } }
  }

  // New user
  const id = crypto.randomUUID()
  await db.prepare(
    'INSERT INTO "User" (id, name, email, password_hash) VALUES (?, ?, ?, ?)'
  ).bind(id, name || email.split('@')[0], email, passwordHash).run()

  await createSession(event, id)
  return { user: { id, email, name: name || email.split('@')[0] } }
})
