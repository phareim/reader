/** @jest-environment node */
/**
 * Two seams to Reader's own satellite services:
 * POST /api/tts → the reader-tts service on Sleeper (tts/server.py), and
 * POST /api/internal/email-ingest ← the reader-email Worker (email-worker/).
 * The far side of each is a hand-written stub.
 */
import {
  fakeD1, fakeBucket, makeEvent, callHandler, mockFetch, authAs, SESSION_COOKIE,
} from '~/__tests__/mocks/nitro'
import { getAuthenticatedUser } from '~/server/utils/auth'

// tts.post.ts relies on Nitro auto-importing this server util.
;(globalThis as any).getAuthenticatedUser = getAuthenticatedUser

import tts from '~/server/api/tts.post'
import emailIngest from '~/server/api/internal/email-ingest.post'

const user = { id: 'user-1', email: 'petter@example.com', name: 'Petter' }

let net: ReturnType<typeof mockFetch>
afterEach(() => net?.restore())

describe('POST /api/tts', () => {
  const config = { ttsApiUrl: 'https://tts.test/reader-tts', ttsApiKey: 'tts-key' }
  const run = (body: unknown, overrides: Record<string, any> = {}) => {
    const event = makeEvent({ method: 'POST', headers: SESSION_COOKIE, body, config, db: fakeD1(authAs(user)), ...overrides })
    return callHandler(tts, event).then((result) => ({ ...result, event }))
  }

  it('forwards the trimmed text with the shared Bearer key and passes the audio type through', async () => {
    net = mockFetch(() => new Response(new Uint8Array([1, 2, 3]), { status: 200, headers: { 'content-type': 'audio/mpeg' } }))

    const { status, body, event } = await run({ text: '  Hei på deg.  ' })

    expect(status).toBe(200)
    expect(net.calls[0]).toMatchObject({
      url: 'https://tts.test/reader-tts/synthesize',
      method: 'POST',
      body: { text: 'Hei på deg.' },
    })
    expect(net.calls[0].headers.authorization).toBe('Bearer tts-key')
    expect(Array.from(body as Uint8Array)).toEqual([1, 2, 3])
    expect(event.node.res.getHeader('content-type')).toBe('audio/mpeg')
    expect(event.node.res.getHeader('cache-control')).toBe('no-store')
  })

  it('answers 400 without text, 413 past 3000 characters, and never calls the service for either', async () => {
    net = mockFetch(() => undefined)
    expect((await run({ text: '   ' })).status).toBe(400)
    expect((await run({})).status).toBe(400)
    expect((await run({ text: 'x'.repeat(3001) })).status).toBe(413)
    expect(net.calls).toHaveLength(0)
  })

  it('answers 503 when unconfigured, 502 when the service fails, 504 when it times out, 401 signed out', async () => {
    net = mockFetch(() => new Response('{"error":"synthesis failed"}', { status: 502 }))
    expect((await run({ text: 'hello' }, { config: {} })).status).toBe(503)
    expect((await run({ text: 'hello' })).status).toBe(502)
    net.restore()

    net = mockFetch(() => { throw Object.assign(new Error('timed out'), { name: 'TimeoutError' }) })
    expect((await run({ text: 'hello' })).status).toBe(504)
    expect((await run({ text: 'hello' }, { db: fakeD1(authAs(null)) })).status).toBe(401)
  })
})

describe('POST /api/internal/email-ingest', () => {
  const config = { emailIngestKey: 'ingest-key', emailDefaultAccount: 'petter@example.com' }
  const mail = {
    senderEmail: 'Petter@Example.com',
    messageId: '<abc@mail.example.com>',
    subject: 'Fwd: A newsletter issue',
    html: '<p>Hello <a href="https://example.com/issue/1">read it</a></p>',
    text: 'Hello',
    receivedAt: '2026-11-21T10:00:00.000Z',
  }
  const ingestDb = (opts: { knownSender?: boolean; defaultAccount?: boolean; recent?: number } = {}) =>
    fakeD1((call) => {
      if (/SELECT id FROM "User" WHERE email = \? COLLATE NOCASE/.test(call.sql)) {
        if (call.binds[0] === 'petter@example.com') return opts.knownSender === false ? null : { id: 'user-1' }
        return null
      }
      if (/SELECT id FROM "Feed" WHERE user_id = \? AND kind = 'found'/.test(call.sql)) return { id: 2 }
      if (/COUNT\(\*\) AS n FROM "Article"/.test(call.sql)) return { n: opts.recent ?? 0 }
      if (/INSERT OR IGNORE INTO "Article"/.test(call.sql)) return { meta: { changes: 1, last_row_id: 60 } }
    })
  const run = (db: ReturnType<typeof fakeD1>, body: unknown = mail, headers: Record<string, string> = { authorization: 'Bearer ingest-key' }, cfg = config) =>
    callHandler(emailIngest, makeEvent({ method: 'POST', headers, body, config: cfg, db, bucket: fakeBucket() }))

  it('stores a registered sender’s mail as an unread Found card keyed by Message-ID', async () => {
    const db = ingestDb()

    const { status, body } = await run(db)

    expect(status).toBe(200)
    expect(body).toEqual({ success: true, ingested: true, existing: false, article: { id: 60, feedId: 2 } })
    const insert = db.matching(/INSERT OR IGNORE INTO "Article"/)[0]
    // feed_id, guid, title, url
    expect(insert.binds.slice(0, 4)).toEqual([2, 'email:abc@mail.example.com', 'A newsletter issue', 'https://example.com/issue/1'])
    expect(insert.binds[8]).toBe('email') // source
    expect(insert.binds[10]).toBe(0) // unread
  })

  it('rejects a wrong or missing Bearer key with 401 before reading the mail', async () => {
    const db = ingestDb()
    expect((await run(db, mail, { authorization: 'Bearer wrong' })).status).toBe(401)
    expect((await run(db, mail, {})).status).toBe(401)
    // An unset key closes the route rather than accepting "Bearer ".
    expect((await run(db, mail, { authorization: 'Bearer ' }, { emailIngestKey: '', emailDefaultAccount: '' })).status).toBe(401)
    expect(db.calls).toHaveLength(0)
  })

  it('answers 403 for an unknown sender when no default account is set (the Worker bounces the mail)', async () => {
    const db = ingestDb()
    const { status } = await run(db, { ...mail, senderEmail: 'stranger@elsewhere.example' }, undefined, { emailIngestKey: 'ingest-key', emailDefaultAccount: '' })
    expect(status).toBe(403)
    expect(db.matching(/INSERT/)).toHaveLength(0)
  })

  it('lands an unknown sender’s mail in the default account', async () => {
    const db = ingestDb()
    const { status, body } = await run(db, { ...mail, senderEmail: 'news@letter.example' })
    expect(status).toBe(200)
    expect(body.ingested).toBe(true)
  })

  it('answers 429 once the account has 20 emails in the last day', async () => {
    const db = ingestDb({ recent: 20 })
    const { status } = await run(db)
    expect(status).toBe(429)
    expect(db.matching(/INSERT OR IGNORE INTO "Article"/)).toHaveLength(0)
  })

  it('answers 400 for a payload without a sender or Message-ID', async () => {
    const { senderEmail, ...noSender } = mail
    expect((await run(ingestDb(), noSender)).status).toBe(400)
    expect((await run(ingestDb(), { ...mail, messageId: '' })).status).toBe(400)
  })
})
