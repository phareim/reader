import type { EmailRig } from './types'
import { tldrRig } from './tldr'

export type { EmailRig } from './types'

/**
 * Per-newsletter email rigs, feedRigs-style: adding one = a new file
 * exporting an EmailRig + a line here (see types.ts for the contract).
 */
const RIGS: EmailRig[] = [tldrRig]

const HREF_HOST_RE = /href=["']https?:\/\/([^/"']+)/gi

/**
 * The rig owning this email, identified by the body's link hosts
 * (www-insensitive). First rig with any matching href wins.
 */
export function rigForEmail(html: string | null | undefined): EmailRig | null {
  if (!html) return null
  const hosts = new Set(
    [...html.matchAll(HREF_HOST_RE)].map((m) => m[1].toLowerCase().replace(/^www\./, ''))
  )
  return RIGS.find((rig) => rig.hosts.some((h) => hosts.has(h))) ?? null
}

/**
 * Run an email through its rig (if any). Fail-soft by contract: a hook
 * that throws or returns null leaves that field on the generic path.
 */
export function applyEmailRig(html: string | null | undefined): {
  rigId: string | null
  url: string | null
  author: string | null
  html: string | null
} {
  const none = { rigId: null, url: null, author: null, html: null }
  if (!html) return none
  const rig = rigForEmail(html)
  if (!rig) return none
  const attempt = <T>(fn: (() => T | null) | undefined): T | null => {
    try {
      return fn?.() ?? null
    } catch {
      return null
    }
  }
  return {
    rigId: rig.id,
    url: attempt(() => rig.pickUrl?.(html) ?? null),
    author: attempt(() => rig.author?.(html) ?? null),
    html: attempt(() => rig.body?.(html) ?? null)
  }
}
