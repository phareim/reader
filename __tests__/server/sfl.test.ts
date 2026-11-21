/** @jest-environment node */
/**
 * Contract tests for the SFL seam (server/utils/sfl.ts): the exact requests
 * Reader sends and how it reads SFL's answers. Responses are hand-written from
 * what this repo's code expects; nothing here reaches the live SFL API.
 */
import { mockFetch, jsonResponse } from '~/__tests__/mocks/nitro'
import { createPageIdea, createQuoteIdea, deleteIdea, findOrCreateTag, tagIdea } from '~/server/utils/sfl'

const cfg = { url: 'https://sfl.test', key: 'sfl-key' }
let net: ReturnType<typeof mockFetch>

afterEach(() => net?.restore())

describe('createPageIdea (elevate)', () => {
  it('POSTs a page idea with the Bearer key and returns the new id', async () => {
    net = mockFetch(() => jsonResponse({ idea: { id: 'idea-1' } }))

    const result = await createPageIdea(cfg, { url: 'https://example.com/a', title: 'A title' })

    expect(result).toEqual({ ideaId: 'idea-1', existing: false })
    expect(net.calls).toHaveLength(1)
    expect(net.calls[0]).toMatchObject({
      url: 'https://sfl.test/api/ideas',
      method: 'POST',
      body: { type: 'page', title: 'A title', url: 'https://example.com/a' },
    })
    expect(net.calls[0].headers.authorization).toBe('Bearer sfl-key')
    expect(net.calls[0].headers['content-type']).toBe('application/json')
  })

  it('reports an idea SFL already held as existing', async () => {
    net = mockFetch(() => jsonResponse({ existing: true, idea: { id: 'idea-old' } }))
    await expect(createPageIdea(cfg, { url: 'https://example.com/a', title: 'A' }))
      .resolves.toEqual({ ideaId: 'idea-old', existing: true })
  })

  it('maps an SFL error status to 502', async () => {
    net = mockFetch(() => jsonResponse({ error: 'nope' }, 500))
    await expect(createPageIdea(cfg, { url: 'https://example.com/a', title: 'A' }))
      .rejects.toMatchObject({ statusCode: 502, statusMessage: 'SFL create failed (500)' })
  })

  it('maps a response without an idea id to 502', async () => {
    net = mockFetch(() => jsonResponse({ idea: {} }))
    await expect(createPageIdea(cfg, { url: 'https://example.com/a', title: 'A' }))
      .rejects.toMatchObject({ statusCode: 502, statusMessage: 'SFL response missing idea id' })
  })

  it('maps a non-JSON answer to 502', async () => {
    net = mockFetch(() => new Response('<html>gateway</html>', { status: 200 }))
    await expect(createPageIdea(cfg, { url: 'https://example.com/a', title: 'A' }))
      .rejects.toMatchObject({ statusCode: 502, statusMessage: 'SFL returned malformed JSON' })
  })

  it('maps a timeout to 504 and any other network failure to 502', async () => {
    net = mockFetch(() => { throw Object.assign(new Error('timed out'), { name: 'TimeoutError' }) })
    await expect(createPageIdea(cfg, { url: 'https://example.com/a', title: 'A' }))
      .rejects.toMatchObject({ statusCode: 504 })
    net.restore()

    net = mockFetch(() => { throw new TypeError('fetch failed') })
    await expect(createPageIdea(cfg, { url: 'https://example.com/a', title: 'A' }))
      .rejects.toMatchObject({ statusCode: 502, statusMessage: 'SFL network error' })
  })
})

describe('createQuoteIdea (highlight)', () => {
  it('POSTs a quote idea without a url, carrying the source in data', async () => {
    net = mockFetch(() => jsonResponse({ idea: { id: 'quote-1' } }))

    const result = await createQuoteIdea(cfg, {
      text: 'A marked passage',
      note: 'why it matters',
      sourceUrl: 'https://example.com/a',
      sourceTitle: 'A title',
    })

    expect(result).toEqual({ ideaId: 'quote-1' })
    expect(net.calls[0].url).toBe('https://sfl.test/api/ideas')
    expect(net.calls[0].method).toBe('POST')
    expect(net.calls[0].body).toEqual({
      type: 'quote',
      title: 'A marked passage',
      summary: 'why it matters',
      data: {
        text: 'A marked passage',
        note: 'why it matters',
        source_url: 'https://example.com/a',
        source_title: 'A title',
      },
    })
    expect(net.calls[0].body).not.toHaveProperty('url')
  })

  it('truncates the title to 120 characters and keeps the full text in data', async () => {
    net = mockFetch(() => jsonResponse({ idea: { id: 'quote-2' } }))
    const text = 'x'.repeat(300)

    await createQuoteIdea(cfg, { text, sourceUrl: 'https://example.com/a', sourceTitle: 'A' })

    expect(net.calls[0].body.title).toHaveLength(120)
    expect(net.calls[0].body.title.endsWith('…')).toBe(true)
    expect(net.calls[0].body.data.text).toBe(text)
    expect(net.calls[0].body).not.toHaveProperty('summary')
  })
})

describe('deleteIdea', () => {
  it('DELETEs the idea by id', async () => {
    net = mockFetch(() => new Response(null, { status: 204 }))
    await deleteIdea(cfg, 'idea/1')
    expect(net.calls[0]).toMatchObject({ url: 'https://sfl.test/api/ideas/idea%2F1', method: 'DELETE' })
    expect(net.calls[0].headers.authorization).toBe('Bearer sfl-key')
  })

  it('treats an already-deleted idea (404) as done', async () => {
    net = mockFetch(() => jsonResponse({ error: 'not found' }, 404))
    await expect(deleteIdea(cfg, 'gone')).resolves.toBeUndefined()
  })

  it('maps any other failure to 502', async () => {
    net = mockFetch(() => jsonResponse({ error: 'boom' }, 500))
    await expect(deleteIdea(cfg, 'idea-1')).rejects.toMatchObject({ statusCode: 502 })
  })
})

describe('findOrCreateTag / tagIdea (highlight #hashtags)', () => {
  it('reuses an existing tag, matched case-insensitively on title', async () => {
    net = mockFetch((call) =>
      call.url.endsWith('/api/tags')
        ? jsonResponse({ tags: [{ id: 'tag-ai', title: 'AI' }, { id: 'tag-x', title: 'other' }] })
        : undefined
    )
    await expect(findOrCreateTag(cfg, '#ai')).resolves.toBe('tag-ai')
    expect(net.calls).toHaveLength(1)
    expect(net.calls[0].method).toBe('GET')
  })

  it('creates a tag idea when none matches', async () => {
    net = mockFetch((call) =>
      call.method === 'GET' ? jsonResponse({ tags: [] }) : jsonResponse({ idea: { id: 'tag-new' } })
    )
    await expect(findOrCreateTag(cfg, 'fresh')).resolves.toBe('tag-new')
    expect(net.calls[1]).toMatchObject({
      url: 'https://sfl.test/api/ideas',
      method: 'POST',
      body: { type: 'tag', title: 'fresh' },
    })
  })

  it('returns null instead of throwing when SFL fails', async () => {
    net = mockFetch(() => { throw new TypeError('fetch failed') })
    await expect(findOrCreateTag(cfg, 'ai')).resolves.toBeNull()
  })

  it('connects an idea to a tag with the tagged_with label', async () => {
    net = mockFetch(() => jsonResponse({ ok: true }))
    await tagIdea(cfg, 'quote-1', 'tag-ai')
    expect(net.calls[0]).toMatchObject({
      url: 'https://sfl.test/api/connections',
      method: 'POST',
      body: { from_id: 'quote-1', to_id: 'tag-ai', label: 'tagged_with' },
    })
  })
})
