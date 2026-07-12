/**
 * reader-email — the email() Worker behind reader@phareim.no.
 * Full design: ../docs/email-ingest.md.
 *
 * Receives mail routed by Cloudflare Email Routing, verifies the sender is
 * plausible (size cap + auth alignment; the registered-account check lives
 * in the Reader, which owns the User table), parses the MIME body with
 * postal-mime, and hands the result to the Reader Worker's
 * POST /api/internal/email-ingest over a dedicated Bearer key. Rejections
 * use setReject() so the sender gets an honest SMTP bounce instead of
 * silence.
 */

import PostalMime from 'postal-mime'
import { senderAuthOk } from './authResults'

const MAX_RAW_BYTES = 2 * 1024 * 1024 // forward a link instead

interface Env {
  READER_API_URL: string
  EMAIL_INGEST_KEY: string
}

export default {
  async email(message: ForwardableEmailMessage, env: Env): Promise<void> {
    if (message.rawSize > MAX_RAW_BYTES) {
      message.setReject('Message too large (2 MB max) — forward a link instead')
      return
    }

    const sender = (message.from || '').toLowerCase().trim()
    const senderDomain = sender.split('@')[1] || ''
    if (!senderDomain) {
      message.setReject('Missing sender address')
      return
    }

    const authHeader =
      message.headers.get('arc-authentication-results') ||
      message.headers.get('authentication-results')
    if (!senderAuthOk(authHeader, senderDomain)) {
      message.setReject('Sender authentication does not match the sending address')
      return
    }

    let parsed: any
    try {
      const raw = await new Response(message.raw).arrayBuffer()
      parsed = await PostalMime.parse(raw)
    } catch (err: any) {
      message.setReject(`Could not parse message: ${err?.message || 'unknown error'}`)
      return
    }

    const payload = {
      senderEmail: sender,
      messageId:
        parsed.messageId || message.headers.get('message-id') || crypto.randomUUID(),
      subject: parsed.subject || undefined,
      html: parsed.html || undefined,
      text: parsed.text || undefined,
      receivedAt: new Date().toISOString(),
    }

    let res: Response
    try {
      res = await fetch(`${env.READER_API_URL}/api/internal/email-ingest`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${env.EMAIL_INGEST_KEY}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify(payload),
      })
    } catch (err: any) {
      message.setReject(`Reader is unreachable — try again later (${err?.message || 'fetch failed'})`)
      return
    }

    if (res.status === 403) {
      message.setReject('This address only accepts mail from registered Reader accounts')
    } else if (res.status === 429) {
      message.setReject('Daily forward limit reached — try again tomorrow')
    } else if (!res.ok) {
      const detail = await res.text().catch(() => '')
      console.error(`email-ingest ${res.status}: ${detail.slice(0, 300)}`)
      message.setReject(`Reader could not store the message (${res.status})`)
    }
    // 2xx: accepted (or an idempotent repeat) — nothing more to do.
  },
}

// Minimal typing for the Email Workers runtime object — enough for this
// file without pulling in @cloudflare/workers-types.
interface ForwardableEmailMessage {
  readonly from: string
  readonly to: string
  readonly headers: Headers
  readonly raw: ReadableStream
  readonly rawSize: number
  setReject(reason: string): void
  forward(rcptTo: string, headers?: Headers): Promise<void>
}
