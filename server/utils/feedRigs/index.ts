import type { FeedRig } from './types'
import { smbcRig } from './smbc'
import { oglafRig } from './oglaf'

export type { FeedRig, RigExtraction, RigPageContext } from './types'

/**
 * Per-feed rigs: bespoke handling for the feeds worth extra work.
 * Adding one = a new file exporting a FeedRig + a line here. Both hooks are
 * optional and fail soft into the generic pipeline (see types.ts).
 */
const RIGS: FeedRig[] = [smbcRig, oglafRig]

const hostOf = (url: string | null | undefined): string | null => {
  if (!url) return null
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, '')
  } catch {
    return null
  }
}

/** The rig owning this URL's host (www-insensitive), if any. */
export function rigForUrl(url: string | null | undefined): FeedRig | null {
  const host = hostOf(url)
  if (!host) return null
  return RIGS.find((rig) => rig.hosts.includes(host)) ?? null
}
