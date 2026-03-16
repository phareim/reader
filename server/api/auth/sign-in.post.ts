import { getD1 } from '~/server/utils/cloudflare'
import { verifyPassword } from '~/server/utils/password'
import { createSession } from '~/server/utils/session'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { email, password } = body || {}

  if (!email || !password) {
    throw createError({ statusCode: 400, statusMessage: 'Email and password are required' })
  }

  const db = getD1(event)
  const user = await db.prepare('SELECT * FROM "User" WHERE email = ?').bind(email).first() as any

  if (!user || !user.password_hash) {
    throw createError({ statusCode: 401, statusMessage: 'Invalid email or password' })
  }

  const valid = await verifyPassword(password, user.password_hash)
  if (!valid) {
    throw createError({ statusCode: 401, statusMessage: 'Invalid email or password' })
  }

  await createSession(event, user.id)

  return { user: { id: user.id, email: user.email, name: user.name } }
})
