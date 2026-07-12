/**
 * Sender-authentication alignment check for the reader-email Worker
 * (docs/email-ingest.md, security layer 3).
 *
 * Cloudflare Email Routing already rejects inbound mail that fails BOTH
 * SPF and DKIM, and stamps what passes with an ARC-Authentication-Results
 * header like:
 *
 *   i=1; mx.cloudflare.net; dkim=pass header.d=gmail.com;
 *   spf=pass (mx.cloudflare.net: domain of x@gmail.com ...)
 *   smtp.mailfrom=gmail.com; dmarc=pass action=none header.from=gmail.com
 *
 * This check adds alignment on top: the passing mechanism must belong to
 * the claimed sender's domain, so mail that authenticated as some
 * unrelated domain can't speak for a registered address. Pure — unit
 * tested from the Reader repo's Jest suite.
 */

/** Relaxed alignment: exact match or org-domain suffix (mail.gmail.com ~ gmail.com). */
function aligned(authDomain: string | undefined, senderDomain: string): boolean {
  if (!authDomain) return false
  const a = authDomain.toLowerCase()
  const s = senderDomain.toLowerCase()
  return a === s || a.endsWith(`.${s}`) || s.endsWith(`.${a}`)
}

/**
 * True when the Authentication-Results header shows a pass aligned with
 * senderDomain: DMARC pass (alignment is DMARC's own definition), or an
 * SPF/DKIM pass whose domain aligns.
 *
 * A missing/empty header returns true — Cloudflare's own SPF-or-DKIM gate
 * has already run at the edge, and rejecting on an absent diagnostic
 * header would silently break the feature if the header ever moves.
 */
export function senderAuthOk(header: string | null | undefined, senderDomain: string): boolean {
  if (!header || !header.trim()) return true
  const h = header.toLowerCase()

  if (/dmarc=pass/.test(h)) return true

  const dkimDomains = [...h.matchAll(/dkim=pass[^;]*?header\.[di]=@?([a-z0-9.-]+)/g)].map((m) => m[1])
  if (dkimDomains.some((d) => aligned(d, senderDomain))) return true

  const spfDomains = [...h.matchAll(/spf=pass[^;]*?smtp\.mailfrom=(?:[^@\s;]*@)?([a-z0-9.-]+)/g)].map((m) => m[1])
  if (spfDomains.some((d) => aligned(d, senderDomain))) return true

  return false
}
