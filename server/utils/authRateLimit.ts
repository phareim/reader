import { H3Event, createError } from 'h3'

/**
 * Sliding-window rate limit for credential attempts, backed by the
 * `auth_attempt` D1 table (migration 009). Keyed on the target email —
 * that is what an attacker guesses against; broad IP spraying is a WAF
 * concern, not an application one.
 */

const WINDOW_MINUTES = 10
const MAX_FAILURES = 10

function windowStart(): string {
  return new Date(Date.now() - WINDOW_MINUTES * 60 * 1000).toISOString()
}

export async function assertNotRateLimited(event: H3Event, db: any, email: string): Promise<void> {
  const row = await db
    .prepare('SELECT COUNT(*) AS n FROM "auth_attempt" WHERE email = ? AND attempted_at > ?')
    .bind(email.toLowerCase(), windowStart())
    .first()
  if ((row?.n ?? 0) >= MAX_FAILURES) {
    throw createError({
      statusCode: 429,
      statusMessage: 'Too many attempts — try again in a few minutes',
    })
  }
}

export async function recordFailedAttempt(event: H3Event, db: any, email: string): Promise<void> {
  const ip = event.node?.req?.headers?.['cf-connecting-ip'] ?? null
  await db
    .prepare('INSERT INTO "auth_attempt" (email, ip, attempted_at) VALUES (?, ?, ?)')
    .bind(email.toLowerCase(), typeof ip === 'string' ? ip : null, new Date().toISOString())
    .run()
}

/** On success: clear the caller's window and opportunistically GC old rows. */
export async function clearAttempts(db: any, email: string): Promise<void> {
  await db.prepare('DELETE FROM "auth_attempt" WHERE email = ?').bind(email.toLowerCase()).run()
  await db
    .prepare('DELETE FROM "auth_attempt" WHERE attempted_at < ?')
    .bind(new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    .run()
}
