/**
 * Per-newsletter rigs for the email→Reader ingest path — the email-shaped
 * sibling of feedRigs (see server/utils/feedRigs/types.ts).
 *
 * A forwarded newsletter arrives with the *forwarder* as sender, so rigs
 * can't key on the envelope; they key on the link hosts inside the body
 * (a newsletter's tracking/CDN domains are its fingerprint).
 *
 * Every hook MUST fail soft — any throw or null return falls back to the
 * generic ingest path, so a rig bug can never lose an email.
 */
export interface EmailRig {
  id: string
  /**
   * Link hosts that identify this newsletter; the rig matches when any
   * href in the body points at one of them (leading `www.` stripped).
   */
  hosts: string[]
  /**
   * Card URL: pick from the body's links. Return null to fall back to
   * the generic first-link heuristic.
   */
  pickUrl?: (html: string) => string | null
  /** Card author, when the newsletter's identity beats the From header. */
  author?: (html: string) => string | null
  /**
   * Clean the body for reading (unwrap tracking redirects, drop pixels).
   * Return null to store the body untouched.
   */
  body?: (html: string) => string | null
}
