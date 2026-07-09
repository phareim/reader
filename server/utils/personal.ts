import { H3Event } from 'h3'

/**
 * Personal-integration gate. SFL elevate, the highlight→SFL mirror, and
 * read-aloud all ride on Petter's own external accounts (SFL API key,
 * NVIDIA/OpenAI TTS) — other Reader users get the core reading experience
 * but must not write into his knowledge pipeline or spend his TTS quota.
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
