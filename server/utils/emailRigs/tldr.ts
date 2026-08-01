import type { EmailRig } from './types'
import { unwrapCl0, unwrapHrefs, stripTrackingPixels } from './unwrap'

/**
 * TLDR (tldr.tech / tldrnewsletter.com), all verticals.
 *
 * Every link is wrapped in a tracking.tldrnewsletter.com `/CL0/` redirect
 * with the real target percent-encoded in the path — so the generic
 * first-link heuristic lands on the wrapped *signup* link, and every
 * click in the reading view detours through the tracker. Unwrapping is
 * pure string work; no fetches.
 */

/** The unwrapped "View Online" target — the issue's canonical web copy. */
const WEB_VERSION_RE = /^https?:\/\/a\.tldrnewsletter\.com\/web-version\b/i

export const tldrRig: EmailRig = {
  id: 'tldr',
  hosts: ['tracking.tldrnewsletter.com', 'tldrnewsletter.com', 'tldr.tech'],

  pickUrl(html) {
    const links = [...html.matchAll(/href=["'](https?:\/\/[^"']+)["']/gi)].map((m) => unwrapCl0(m[1]))
    return links.find((url) => WEB_VERSION_RE.test(url)) ?? null
  },

  author() {
    return 'TLDR'
  },

  body(html) {
    return stripTrackingPixels(unwrapHrefs(html, unwrapCl0))
  }
}
