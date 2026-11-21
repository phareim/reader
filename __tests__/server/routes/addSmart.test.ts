/** @jest-environment node */
/**
 * POST /api/feeds/add-smart and feed discovery: a bare domain typed into the
 * Sources add form gets https:// put in front. The remote site is a
 * hand-written fetch stub.
 */
import { fakeD1, fakeBucket, makeEvent, callHandler, mockFetch, authAs, SESSION_COOKIE } from '~/__tests__/mocks/nitro'
import addSmart from '~/server/api/feeds/add-smart.post'
import addFeedRoute from '~/server/api/feeds/index.post'
import discoverRoute from '~/server/api/feeds/discover.post'
import markRead from '~/server/api/articles/[id]/read.patch'
import { discoverFeeds } from '~/server/utils/feedDiscovery'
import { addFeedForUser } from '~/server/utils/addFeed'

// The feed parser's dependency chain is ESM-only and does not load under
// Jest, so the subscribe step is a stub that records the URL it was given.
jest.mock('~/server/utils/addFeed', () => ({ addFeedForUser: jest.fn() }))
const addFeed = addFeedForUser as jest.Mock

const user = { id: 'user-1', email: 'petter@example.com', name: 'Petter' }

let net: ReturnType<typeof mockFetch>
afterEach(() => net?.restore())

describe('discoverFeeds', () => {
  it('treats a bare domain as https, also when the domain itself starts with "http"', async () => {
    net = mockFetch((call) => (call.url.startsWith('https://')
      ? new Response('<html><head><link rel="alternate" type="application/rss+xml" title="Blog" href="/feed.xml"></head></html>', {
          status: 200, headers: { 'content-type': 'text/html' },
        })
      : undefined))

    const feeds = await discoverFeeds('httpie.io')

    expect(net.calls[0].url).toBe('https://httpie.io')
    expect(feeds).toHaveLength(1)
    expect(feeds[0]).toMatchObject({ title: 'Blog', type: 'rss' })
  })

  it('leaves an explicit http:// or https:// URL as typed', async () => {
    net = mockFetch(() => new Response('<html></html>', { status: 404 }))
    await expect(discoverFeeds('http://example.com/blog')).rejects.toThrow('HTTP 404')
    expect(net.calls[0].url).toBe('http://example.com/blog')
  })
})

describe('POST /api/feeds/add-smart', () => {
  it('subscribes to a bare domain that starts with "http"', async () => {
    net = mockFetch(() => undefined)
    addFeed.mockImplementation(async (_event: any, _userId: string, url: string) => ({
      existing: false, feed: { id: 12, title: 'HTTPie blog', url }, articlesAdded: 1,
    }))

    const { status, body } = await callHandler(addSmart, makeEvent({
      method: 'POST', headers: SESSION_COOKIE, body: { url: ' httpie.io ' }, db: fakeD1(authAs(user)), bucket: fakeBucket(),
    }))

    expect(status).toBe(200)
    expect(addFeed.mock.calls[0].slice(1)).toEqual(['user-1', 'https://httpie.io'])
    expect(body).toEqual({
      type: 'feed_added',
      message: 'Feed added successfully with 1 articles',
      feed: { id: 12, title: 'HTTPie blog', url: 'https://httpie.io' },
      articlesAdded: 1,
    })
  })

  it('answers 400 without a url and 401 signed out', async () => {
    const run = (db: ReturnType<typeof fakeD1>, body: unknown) =>
      callHandler(addSmart, makeEvent({ method: 'POST', headers: SESSION_COOKIE, body, db, bucket: fakeBucket() }))
    expect((await run(fakeD1(authAs(user)), {})).status).toBe(400)
    expect((await run(fakeD1(authAs(null)), { url: 'example.com' })).status).toBe(401)
  })
})

describe('routes that read a field off the JSON body', () => {
  it('answer 400, not 500, when the request has no body at all', async () => {
    net = mockFetch(() => undefined)
    const noBody = (handler: any, method: string, params: Record<string, string> = {}) =>
      callHandler(handler, makeEvent({ method, headers: SESSION_COOKIE, params, db: fakeD1(authAs(user)), bucket: fakeBucket() }))

    expect((await noBody(addSmart, 'POST')).status).toBe(400)
    expect((await noBody(addFeedRoute, 'POST')).status).toBe(400)
    expect((await noBody(discoverRoute, 'POST')).status).toBe(400)
    expect((await noBody(markRead, 'PATCH', { id: '7' })).status).toBe(400)
    expect(net.calls).toHaveLength(0)
  })
})
