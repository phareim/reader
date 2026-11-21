/** @jest-environment node */
/**
 * POST /api/articles/:id/highlights and DELETE /api/highlights/:id — the
 * routes where a highlight becomes an SFL quote and a taste-maker item.
 * SFL and taste-maker are hand-written fetch stubs.
 */
import {
  fakeD1, makeEvent, callHandler, mockFetch, jsonResponse, authAs, SESSION_COOKIE,
} from '~/__tests__/mocks/nitro'
import createHighlight from '~/server/api/articles/[id]/highlights.post'
import deleteHighlight from '~/server/api/highlights/[id].delete'

const petter = { id: 'user-1', email: 'petter@example.com', name: 'Petter' }
const guest = { id: 'user-2', email: 'guest@example.com', name: 'Guest' }
const config = {
  personalEmails: 'Petter@Example.com',
  sflApiUrl: 'https://sfl.test',
  sflApiKey: 'sfl-key',
  tasteApiUrl: 'https://taste.test',
  tasteIngestKey: 'taste-key',
}
const article = { id: 7, url: 'https://example.com/a', title: 'A title' }
const body = { quote: '  A marked passage  ', note: 'worth it #ai', startOffset: 10, endOffset: 26 }

let net: ReturnType<typeof mockFetch>
afterEach(() => net?.restore())

const sflAndTaste = () => mockFetch((call) => {
  if (call.url === 'https://sfl.test/api/ideas' && call.body?.type === 'quote') return jsonResponse({ idea: { id: 'quote-1' } })
  if (call.url === 'https://sfl.test/api/tags') return jsonResponse({ tags: [{ id: 'tag-ai', title: 'ai' }] })
  if (call.url === 'https://sfl.test/api/connections') return jsonResponse({ ok: true })
  if (call.url.startsWith('https://sfl.test/api/ideas/') && call.method === 'DELETE') return new Response(null, { status: 204 })
  if (call.url === 'https://taste.test/api/ingest/highlight') return jsonResponse({ item: { id: 'item-1' } })
  if (call.url.startsWith('https://taste.test/api/ingest/highlight/')) return new Response(null, { status: 204 })
  return undefined
})

const post = (db: ReturnType<typeof fakeD1>, overrides: Record<string, any> = {}) =>
  callHandler(createHighlight, makeEvent({
    method: 'POST', headers: SESSION_COOKIE, params: { id: '7' }, body, config, db, ...overrides,
  }))

describe('POST /api/articles/:id/highlights', () => {
  it('mirrors a personal account’s highlight to SFL and taste-maker and stores both ids', async () => {
    net = sflAndTaste()
    const db = fakeD1(authAs(petter, (call) => {
      if (/FROM "Article" a/.test(call.sql)) return article
      if (/INSERT INTO "Highlight"/.test(call.sql)) return { meta: { changes: 1, last_row_id: 99 } }
    }))

    const { status, body: out } = await post(db)

    expect(status).toBe(200)
    expect(out).toMatchObject({
      success: true,
      highlight: {
        id: 99, articleId: 7, sflIdeaId: 'quote-1', tasteItemId: 'item-1',
        quote: 'A marked passage', note: 'worth it #ai', startOffset: 10, endOffset: 26,
      },
    })

    const quoteCall = net.calls.find((c) => c.body?.type === 'quote')!
    expect(quoteCall.body.data).toEqual({
      text: 'A marked passage', note: 'worth it #ai',
      source_url: 'https://example.com/a', source_title: 'A title',
    })
    // #ai in the note becomes a tagged_with connection on the quote.
    expect(net.calls.find((c) => c.url.endsWith('/api/connections'))!.body)
      .toEqual({ from_id: 'quote-1', to_id: 'tag-ai', label: 'tagged_with' })
    // taste-maker is keyed by the Reader highlight row id.
    expect(net.calls.find((c) => c.url.endsWith('/api/ingest/highlight'))!.body)
      .toMatchObject({ highlight_id: 99, quote: 'A marked passage', source_url: 'https://example.com/a' })

    const insert = db.matching(/INSERT INTO "Highlight"/)[0]
    expect(insert.binds.slice(0, 7)).toEqual(['user-1', 7, 'quote-1', 'A marked passage', 'worth it #ai', 10, 26])
    expect(db.matching(/UPDATE "Highlight" SET taste_item_id/)[0].binds).toEqual(['item-1', 99])
  })

  it('keeps a guest’s highlight local: no call to SFL or taste-maker', async () => {
    net = sflAndTaste()
    const db = fakeD1(authAs(guest, (call) => {
      if (/FROM "Article" a/.test(call.sql)) return article
      if (/INSERT INTO "Highlight"/.test(call.sql)) return { meta: { changes: 1, last_row_id: 5 } }
    }))

    const { status, body: out } = await post(db)

    expect(status).toBe(200)
    expect(out.highlight).toMatchObject({ id: 5, sflIdeaId: null, tasteItemId: null })
    expect(net.calls).toHaveLength(0)
  })

  it('stores the highlight locally when SFL is not configured', async () => {
    net = sflAndTaste()
    const db = fakeD1(authAs(petter, (call) => {
      if (/FROM "Article" a/.test(call.sql)) return article
      if (/INSERT INTO "Highlight"/.test(call.sql)) return { meta: { changes: 1, last_row_id: 6 } }
    }))

    const { status, body: out } = await post(db, { config: { personalEmails: config.personalEmails } })

    expect(status).toBe(200)
    expect(out.highlight).toMatchObject({ id: 6, sflIdeaId: null, tasteItemId: null })
    expect(net.calls).toHaveLength(0)
  })

  it('surfaces an SFL failure and stores nothing', async () => {
    net = mockFetch(() => jsonResponse({ error: 'down' }, 500))
    const db = fakeD1(authAs(petter, (call) => (/FROM "Article" a/.test(call.sql) ? article : undefined)))

    const { status } = await post(db)

    expect(status).toBe(502)
    expect(db.matching(/INSERT INTO "Highlight"/)).toHaveLength(0)
  })

  it('deletes the SFL quote again when the local row cannot be written', async () => {
    net = sflAndTaste()
    const db = fakeD1(authAs(petter, (call) => {
      if (/FROM "Article" a/.test(call.sql)) return article
      if (/INSERT INTO "Highlight"/.test(call.sql)) throw new Error('D1_ERROR: database is locked')
    }))

    await expect(post(db)).rejects.toThrow('database is locked')

    // Quotes carry no url, so SFL cannot dedupe a retry: without the undo
    // every failed attempt would leave one more orphan quote behind.
    expect(net.calls.filter((c) => c.method === 'DELETE').map((c) => c.url))
      .toEqual(['https://sfl.test/api/ideas/quote-1'])
  })

  it('rejects an empty quote or inverted offsets with 400, and another user’s article with 404', async () => {
    net = sflAndTaste()
    const db = fakeD1(authAs(petter))

    expect((await post(db, { body: { ...body, quote: '   ' } })).status).toBe(400)
    expect((await post(db, { body: { ...body, endOffset: 10 } })).status).toBe(400)
    expect((await post(db)).status).toBe(404)
    expect(net.calls).toHaveLength(0)
  })

  it('requires a signed-in user', async () => {
    const { status } = await post(fakeD1(authAs(null)))
    expect(status).toBe(401)
  })
})

describe('DELETE /api/highlights/:id', () => {
  const del = (db: ReturnType<typeof fakeD1>) =>
    callHandler(deleteHighlight, makeEvent({
      method: 'DELETE', headers: SESSION_COOKIE, params: { id: '99' }, config, db,
    }))

  it('removes the SFL quote, undoes the taste-maker mirror and drops the row', async () => {
    net = sflAndTaste()
    const db = fakeD1(authAs(petter, (call) => {
      if (/FROM "Highlight" WHERE id = \? AND user_id = \?/.test(call.sql)) {
        return { id: 99, sfl_idea_id: 'quote-1', taste_item_id: 'item-1' }
      }
    }))

    const { status, body: out } = await del(db)

    expect(status).toBe(200)
    expect(out).toEqual({ success: true })
    expect(net.calls.map((c) => `${c.method} ${c.url}`)).toEqual([
      'DELETE https://sfl.test/api/ideas/quote-1',
      'DELETE https://taste.test/api/ingest/highlight/99',
    ])
    expect(db.matching(/DELETE FROM "Highlight"/)[0].binds).toEqual([99])
  })

  it('answers 404 for a highlight the caller does not own and deletes nothing', async () => {
    net = sflAndTaste()
    const db = fakeD1(authAs(guest))

    const { status } = await del(db)

    expect(status).toBe(404)
    expect(net.calls).toHaveLength(0)
    expect(db.matching(/DELETE FROM "Highlight"/)).toHaveLength(0)
  })
})
