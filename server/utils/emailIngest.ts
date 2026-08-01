/**
 * Pure helpers for the email→Reader ingest path (docs/email-ingest.md).
 * Shared shapes only — no D1/R2/h3 imports, so Jest tests them directly.
 */

// "Fwd: Fw: Re: SV: VS:" chains (incl. Norwegian) stripped from a forwarded
// subject; the remainder is the card title.
const FORWARD_PREFIX_RE = /^(\s*(fwd?|re|sv|vs)\s*:\s*)+/i

export function stripForwardPrefixes(subject: string | null | undefined): string {
  const cleaned = (subject || '').replace(FORWARD_PREFIX_RE, '').trim()
  return cleaned || 'Untitled email'
}

/**
 * First http(s) link in the body — usually the newsletter's own
 * "view in browser" link, which makes a genuinely useful card URL.
 * Prefers href attributes (HTML part) over bare URLs (text part).
 */
export function firstHttpLink(html?: string | null, text?: string | null): string | null {
  const fromHref = html?.match(/href=["'](https?:\/\/[^"']+)["']/i)?.[1]
  if (fromHref) return fromHref
  const fromText = (html || text || '').match(/https?:\/\/[^\s"'<>)\]]+/i)?.[0]
  // A bare URL at sentence end drags its punctuation along — shed it.
  return fromText ? fromText.replace(/[.,;:!?]+$/, '') : null
}

/**
 * The account an incoming email belongs to. Normally the sender — but
 * Gmail's forward-to-this-address verification arrives from Google with
 * the Gmail account being set up named in the subject
 * ("… Receive Mail from <user>@gmail.com"); route it to that account so
 * the confirmation code lands in Found instead of bouncing.
 */
export function ingestAccountEmail(senderEmail: string, subject?: string | null): string {
  const sender = senderEmail.toLowerCase()
  if (sender !== 'forwarding-noreply@google.com') return sender
  return subject?.match(/from\s+([^\s<>]+@[^\s<>]+)/i)?.[1]?.toLowerCase() || sender
}

// "View Online" / "View in browser" / "Web version" — the newsletter's own
// canonical link, better than whatever link happens to come first.
const VIEW_ONLINE_RE = /view\s+(?:this\s+)?(?:email\s+)?(?:online|in\s+(?:your\s+)?browser)|web\s*.?\s*version|read\s+online/i

/**
 * The newsletter's "view in browser" link, found by anchor text. Falls back
 * to null; callers chain `?? firstHttpLink(...)`.
 */
export function viewInBrowserLink(html?: string | null): string | null {
  if (!html) return null
  const anchorRe = /<a\b[^>]*href=["'](https?:\/\/[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi
  let m: RegExpExecArray | null
  while ((m = anchorRe.exec(html))) {
    const label = m[2].replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
    // hrefs in raw HTML carry entity-encoded ampersands.
    if (VIEW_ONLINE_RE.test(label)) return m[1].replace(/&amp;/g, '&')
  }
  return null
}

// FNV-1a 32-bit — sync, deterministic; only used to compress over-long
// Message-IDs into the guid budget, not for security.
function fnv1a(s: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(16).padStart(8, '0')
}

/**
 * Message-ID → idempotent guid `email:<id>`, kept inside the same length
 * budget as other Found guids. Angle brackets and whitespace are shed;
 * an over-long id keeps a recognizable prefix plus a hash of the whole.
 */
export function emailGuid(messageId: string): string {
  const id = messageId.trim().replace(/^<|>$/g, '').trim()
  if (id.length <= 170) return `email:${id}`
  return `email:${id.slice(0, 140)}#${fnv1a(id)}`
}
