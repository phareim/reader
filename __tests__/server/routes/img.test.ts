/** @jest-environment node */
/** GET /api/img — the image proxy's edge cache and its fallback redirect. */
import { fakeD1, makeEvent, callHandler, mockFetch, SESSION_COOKIE } from '~/__tests__/mocks/nitro'
import img from '~/server/api/img.get'

let net: ReturnType<typeof mockFetch>
const puts: string[] = []
beforeEach(() => {
  puts.length = 0
  ;(globalThis as any).caches = {
    default: {
      match: async () => undefined,
      put: async (req: Request) => { puts.push(req.url) },
    },
  }
})
afterEach(() => {
  net?.restore()
  delete (globalThis as any).caches
})

const signedIn = () => fakeD1((call) => (/FROM "session" WHERE token = \? AND expires_at > \?/.test(call.sql) ? { 1: 1 } : undefined))
const run = () => callHandler(img, makeEvent({
  url: '/api/img?w=480&u=https%3A%2F%2Fexample.com%2Fa.png', headers: SESSION_COOKIE, db: signedIn(),
}))

describe('GET /api/img', () => {
  it('redirects to the original when upstream fails, without putting the redirect in the edge cache', async () => {
    net = mockFetch(() => new Response('blocked', { status: 403 }))

    const { body } = await run()

    expect(body.status).toBe(302)
    expect(body.headers.get('location')).toBe('https://example.com/a.png')
    expect(body.headers.get('cache-control')).not.toContain('public')
    expect(puts).toHaveLength(0)
  })

  it('still caches a served image', async () => {
    net = mockFetch(() => new Response(new Uint8Array([1, 2, 3]), { status: 200, headers: { 'content-type': 'image/png' } }))

    const { body } = await run()

    expect(body.status).toBe(200)
    expect(body.headers.get('x-reader-img')).toBe('passthrough')
    expect(puts).toHaveLength(1)
  })

  it('answers 401 to a signed-out caller on a cache miss', async () => {
    net = mockFetch(() => undefined)
    const { status } = await callHandler(img, makeEvent({ url: '/api/img?w=480&u=https%3A%2F%2Fexample.com%2Fa.png', db: fakeD1() }))
    expect(status).toBe(401)
    expect(net.calls).toHaveLength(0)
  })
})
