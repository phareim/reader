/** @jest-environment node */
/** GET /api/bridge/anthropic/:section — the public RSS bridge. */
import { makeEvent, callHandler, mockFetch } from '~/__tests__/mocks/nitro'
import bridge from '~/server/api/bridge/anthropic/[section].get'

let net: ReturnType<typeof mockFetch>
afterEach(() => net?.restore())

describe('GET /api/bridge/anthropic/:section', () => {
  it('answers 404 for a section it does not have, including names every object inherits', async () => {
    net = mockFetch(() => undefined)

    for (const section of ['red', 'constructor', 'toString', '__proto__']) {
      const { status } = await callHandler(bridge, makeEvent({ params: { section } }))
      expect(status).toBe(404)
    }
    expect(net.calls).toHaveLength(0)
  })

  it('answers 502 when the upstream listing cannot be fetched', async () => {
    net = mockFetch(() => new Response('nope', { status: 503 }))
    const { status } = await callHandler(bridge, makeEvent({ params: { section: 'news' } }))
    expect(status).toBe(502)
    expect(net.calls[0].url).toBe('https://www.anthropic.com/news')
  })
})
