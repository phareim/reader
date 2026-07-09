import { H3Event } from 'h3'

/**
 * Personal-integration gate. SFL elevate and the highlight→SFL mirror
 * write into Petter's own knowledge pipeline — other Reader users get the
 * core reading experience without them. (Read-aloud is deliberately NOT
 * gated: Petter foots the TTS bill for guests.)
 * NUXT_PERSONAL_EMAILS is a comma-separated allowlist.
 */
export function isPersonalUser(event: H3Event, user: { email?: string } | null): boolean {
  if (!user?.email) return false
  const allowed = (useRuntimeConfig(event).personalEmails || '')
    .split(',')
    .map((e: string) => e.trim().toLowerCase())
    .filter(Boolean)
  return allowed.includes(user.email.toLowerCase())
}
