/** @jest-environment node */
/**
 * Contract tests for the Taste seam (server/utils/taste.ts): the requests
 * Reader sends to taste-maker's highlight ingest and how it reads the answer.
 * Hand-written responses; nothing here reaches the live service.
 */
import { mockFetch, jsonResponse } from '~/__tests__/mocks/nitro'
import { createQuoteItem, deleteQuoteItem } from '~/server/utils/taste'

const cfg = { url: 'https://taste.test', key: 'taste-key' }
let net: ReturnType<typeof mockFetch>

afterEach(() => net?.restore())

describe('createQuoteItem', () => {
  it('POSTs the highlight keyed by its Reader id and returns the item id', async () => {
    net = mockFetch(() => jsonResponse({ item: { id: 'item-1' } }))

    const id = await createQuoteItem(cfg, {
      highlightId: 42,
      quote: 'A marked passage',
      note: 'why',
      sourceUrl: 'https://example.com/a',
      sourceTitle: 'A title',
    })

    expect(id).toBe('item-1')
    expect(net.calls[0]).toMatchObject({
      url: 'https://taste.test/api/ingest/highlight',
      method: 'POST',
      body: {
        highlight_id: 42,
        quote: 'A marked passage',
        note: 'why',
        source_url: 'https://example.com/a',
        source_title: 'A title',
      },
    })
    expect(net.calls[0].headers.authorization).toBe('Bearer taste-key')
  })

  it('returns null on an error status, a missing id, or a network failure', async () => {
    const highlight = { highlightId: 1, quote: 'q', sourceUrl: 'https://example.com/a', sourceTitle: 'A' }

    net = mockFetch(() => jsonResponse({ error: 'nope' }, 500))
    await expect(createQuoteItem(cfg, highlight)).resolves.toBeNull()
    net.restore()

    net = mockFetch(() => jsonResponse({ item: {} }))
    await expect(createQuoteItem(cfg, highlight)).resolves.toBeNull()
    net.restore()

    net = mockFetch(() => { throw new TypeError('fetch failed') })
    await expect(createQuoteItem(cfg, highlight)).resolves.toBeNull()
  })
})

describe('deleteQuoteItem', () => {
  it('DELETEs by Reader highlight id and never throws', async () => {
    net = mockFetch(() => new Response(null, { status: 204 }))
    await deleteQuoteItem(cfg, 42)
    expect(net.calls[0]).toMatchObject({ url: 'https://taste.test/api/ingest/highlight/42', method: 'DELETE' })
    expect(net.calls[0].headers.authorization).toBe('Bearer taste-key')
    net.restore()

    net = mockFetch(() => { throw new TypeError('fetch failed') })
    await expect(deleteQuoteItem(cfg, 42)).resolves.toBeUndefined()
  })
})
