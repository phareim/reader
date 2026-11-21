/** @jest-environment node */
/**
 * POST / DELETE /api/articles/:id/elevate — an elevated article becomes an
 * SFL page idea. SFL is a hand-written fetch stub.
 */
import {
  fakeD1, makeEvent, callHandler, mockFetch, jsonResponse, authAs, SESSION_COOKIE,
} from '~/__tests__/mocks/nitro'
import elevate from '~/server/api/articles/[id]/elevate.post'
import undoElevate from '~/server/api/articles/[id]/elevate.delete'

const petter = { id: 'user-1', email: 'petter@example.com', name: 'Petter' }
const guest = { id: 'user-2', email: 'guest@example.com', name: 'Guest' }
const config = { personalEmails: 'petter@example.com', sflApiUrl: 'https://sfl.test', sflApiKey: 'sfl-key' }
const article = { id: 7, url: 'https://example.com/a', title: 'A title' }

let net: ReturnType<typeof mockFetch>
afterEach(() => net?.restore())

const run = (handler: any, db: ReturnType<typeof fakeD1>, overrides: Record<string, any> = {}) =>
  callHandler(handler, makeEvent({
    method: 'POST', headers: SESSION_COOKIE, params: { id: '7' }, config, db, ...overrides,
  }))

describe('POST /api/articles/:id/elevate', () => {
  it('creates an SFL page idea, marks the article read and remembers the idea id', async () => {
    net = mockFetch(() => jsonResponse({ idea: { id: 'idea-1' } }))
    const db = fakeD1(authAs(petter, (call) => (/SELECT a\.id, a\.title, a\.url/.test(call.sql) ? article : undefined)))

    const { status, body } = await run(elevate, db)

    expect(status).toBe(200)
    expect(body).toEqual({ success: true, ideaId: 'idea-1', existing: false })
    expect(net.calls).toHaveLength(1)
    expect(net.calls[0]).toMatchObject({
      url: 'https://sfl.test/api/ideas',
      method: 'POST',
      body: { type: 'page', title: 'A title', url: 'https://example.com/a' },
    })
    const update = db.matching(/UPDATE "Article" SET is_read = 1, read_at = \?, sfl_idea_id = \?/)[0]
    expect(update.binds.slice(1)).toEqual(['idea-1', 7])
  })

  it('does not claim an idea SFL already held', async () => {
    net = mockFetch(() => jsonResponse({ existing: true, idea: { id: 'idea-old' } }))
    const db = fakeD1(authAs(petter, (call) => (/SELECT a\.id, a\.title, a\.url/.test(call.sql) ? article : undefined)))

    const { body } = await run(elevate, db)

    expect(body).toEqual({ success: true, ideaId: 'idea-old', existing: true })
    expect(db.matching(/UPDATE "Article" SET is_read = 1/)[0].binds.slice(1)).toEqual([null, 7])
  })

  it('undoes the idea it created when the article cannot be updated, but never a pre-existing one', async () => {
    const failingDb = () => fakeD1(authAs(petter, (call) => {
      if (/SELECT a\.id, a\.title, a\.url/.test(call.sql)) return article
      if (/UPDATE "Article"/.test(call.sql)) throw new Error('D1_ERROR: database is locked')
    }))

    net = mockFetch((call) => (call.method === 'POST' ? jsonResponse({ idea: { id: 'idea-1' } }) : new Response(null, { status: 204 })))
    await expect(run(elevate, failingDb())).rejects.toThrow('database is locked')
    expect(net.calls.map((c) => `${c.method} ${c.url}`)).toEqual([
      'POST https://sfl.test/api/ideas',
      'DELETE https://sfl.test/api/ideas/idea-1',
    ])
    net.restore()

    net = mockFetch(() => jsonResponse({ existing: true, idea: { id: 'idea-old' } }))
    await expect(run(elevate, failingDb())).rejects.toThrow('database is locked')
    expect(net.calls.map((c) => c.method)).toEqual(['POST'])
  })

  it('is refused (403) for an account outside the personal allowlist, before any lookup or SFL call', async () => {
    net = mockFetch(() => jsonResponse({ idea: { id: 'idea-1' } }))
    const db = fakeD1(authAs(guest))

    const { status } = await run(elevate, db)

    expect(status).toBe(403)
    expect(net.calls).toHaveLength(0)
    expect(db.matching(/"Article"/)).toHaveLength(0)
  })

  it('answers 401 signed out, 404 for another user’s article and 503 when SFL is not configured', async () => {
    net = mockFetch(() => jsonResponse({ idea: { id: 'idea-1' } }))

    expect((await run(elevate, fakeD1(authAs(null)))).status).toBe(401)
    expect((await run(elevate, fakeD1(authAs(petter)))).status).toBe(404)
    const db = fakeD1(authAs(petter, (call) => (/SELECT a\.id, a\.title, a\.url/.test(call.sql) ? article : undefined)))
    expect((await run(elevate, db, { config: { personalEmails: 'petter@example.com' } })).status).toBe(503)
    expect(net.calls).toHaveLength(0)
  })
})

describe('DELETE /api/articles/:id/elevate', () => {
  it('deletes the idea the elevate recorded and returns the article to unread', async () => {
    net = mockFetch(() => new Response(null, { status: 204 }))
    const db = fakeD1(authAs(petter, (call) =>
      (/SELECT a\.id, a\.sfl_idea_id/.test(call.sql) ? { id: 7, sfl_idea_id: 'idea-1' } : undefined)))

    const { status, body } = await run(undoElevate, db, { method: 'DELETE' })

    expect(status).toBe(200)
    expect(body).toEqual({ success: true })
    expect(net.calls.map((c) => `${c.method} ${c.url}`)).toEqual(['DELETE https://sfl.test/api/ideas/idea-1'])
    expect(db.matching(/UPDATE "Article" SET is_read = 0, read_at = NULL, sfl_idea_id = NULL/)[0].binds).toEqual([7])
  })

  it('leaves SFL alone when the elevate found a pre-existing idea', async () => {
    net = mockFetch(() => new Response(null, { status: 204 }))
    const db = fakeD1(authAs(petter, (call) =>
      (/SELECT a\.id, a\.sfl_idea_id/.test(call.sql) ? { id: 7, sfl_idea_id: null } : undefined)))

    const { status } = await run(undoElevate, db, { method: 'DELETE' })

    expect(status).toBe(200)
    expect(net.calls).toHaveLength(0)
    expect(db.matching(/UPDATE "Article" SET is_read = 0/)).toHaveLength(1)
  })

  it('is refused (403) for an account outside the personal allowlist', async () => {
    net = mockFetch(() => new Response(null, { status: 204 }))
    const { status } = await run(undoElevate, fakeD1(authAs(guest)), { method: 'DELETE' })
    expect(status).toBe(403)
    expect(net.calls).toHaveLength(0)
  })
})
