/** @jest-environment node */
/**
 * POST /api/ingest — the seam the Sleeper-side collectors (sleeper-articles,
 * Bluesky, the AI digest) push Found cards through with `X-MCP-Token`.
 * D1 and R2 are fakes.
 */
import { fakeD1, fakeBucket, makeEvent, callHandler, authAs, MCP_HEADER } from '~/__tests__/mocks/nitro'
import ingest from '~/server/api/ingest.post'

const user = { id: 'user-1', email: 'petter@example.com', name: 'Petter' }
const item = {
  source: 'sleeper-articles',
  externalId: 'abc123',
  url: 'https://example.com/post?utm_source=x',
  title: 'A digest',
  author: 'Sleeper',
  content: '<p>The essay body about <strong>otters</strong>.</p>',
  summary: 'About otters',
  imageUrl: 'https://example.com/lead.jpg',
  publishedAt: '2026-11-20T08:00:00.000Z',
}

const ingestDb = (opts: { existingId?: number; urlDup?: { id: number; source: string } } = {}) =>
  fakeD1(authAs(user, (call) => {
    if (/SELECT id FROM "Feed" WHERE user_id = \? AND kind = 'found'/.test(call.sql)) return { id: 2 }
    if (/SELECT id(, content_key)? FROM "Article" WHERE feed_id = \? AND guid = \?/.test(call.sql)) {
      return opts.existingId ? { id: opts.existingId, content_key: `articles/${opts.existingId}.html` } : null
    }
    if (/SELECT id, source FROM "Article" WHERE feed_id = \? AND url_norm = \?/.test(call.sql)) return opts.urlDup ?? null
    if (/INSERT OR IGNORE INTO "Article"/.test(call.sql)) return { meta: { changes: 1, last_row_id: 50 } }
  }))

const run = (db: ReturnType<typeof fakeD1>, body: unknown, bucket = fakeBucket()) =>
  callHandler(ingest, makeEvent({ method: 'POST', headers: MCP_HEADER, body, db, bucket }))

describe('POST /api/ingest', () => {
  it('stores a new item unread in the Found feed under guid source:externalId', async () => {
    const db = ingestDb()
    const bucket = fakeBucket()

    const { status, body } = await run(db, item, bucket)

    expect(status).toBe(200)
    expect(body).toEqual({
      success: true, ingested: true, existing: false,
      article: { id: 50, url: item.url, feedId: 2 },
    })
    const insert = db.matching(/INSERT OR IGNORE INTO "Article"/)[0]
    // feed_id, guid, title, url, author, summary, image_url, published_at, source, url_norm, is_read
    expect(insert.binds.slice(0, 11)).toEqual([
      2, 'sleeper-articles:abc123', 'A digest', item.url, 'Sleeper', 'About otters',
      'https://example.com/lead.jpg', '2026-11-20T08:00:00.000Z', 'sleeper-articles', 'example.com/post', 0,
    ])
    expect(bucket.objects.get('articles/50.html')).toBe(item.content)
  })

  it('is a no-op for a guid it already holds', async () => {
    const db = ingestDb({ existingId: 44 })

    const { body } = await run(db, item)

    expect(body).toEqual({ success: true, ingested: false, existing: true, article: { id: 44, url: item.url, feedId: 2 } })
    expect(db.matching(/INSERT|UPDATE/)).toHaveLength(0)
  })

  it('rebuilds the card in place and returns it to unread with replace: true', async () => {
    const db = ingestDb({ existingId: 44 })
    const bucket = fakeBucket({ 'articles/44.html': '<p>old</p>' })

    const { body } = await run(db, { ...item, replace: true }, bucket)

    expect(body).toEqual({
      success: true, ingested: false, existing: true, replaced: true,
      article: { id: 44, url: item.url, feedId: 2 },
    })
    expect(bucket.objects.get('articles/44.html')).toBe(item.content)
    const update = db.matching(/UPDATE "Article" SET title = \?/)[0]
    expect(update.sql).toContain('is_read = 0, read_at = NULL, read_progress = 0')
    expect(update.binds).toEqual([
      'A digest', item.url, 'Sleeper', 'About otters', 'https://example.com/lead.jpg',
      '2026-11-20T08:00:00.000Z', 'articles/44.html', 'example.com/post', 44,
    ])
    const fts = db.matching(/INSERT INTO "ArticleFts"/)[0]
    expect(fts.binds).toEqual([44, 'A digest', 'About otters', 'The essay body about otters .'])
  })

  it('keeps the stored body searchable when a replace carries no content', async () => {
    const db = ingestDb({ existingId: 44 })
    const bucket = fakeBucket({ 'articles/44.html': '<p>The stored body about <em>badgers</em>.</p>' })
    const { content, ...withoutContent } = item

    const { body } = await run(db, { ...withoutContent, replace: true, title: 'Retitled' }, bucket)

    expect(body.replaced).toBe(true)
    // The R2 body is untouched (content_key is kept by COALESCE) …
    expect(bucket.objects.get('articles/44.html')).toContain('badgers')
    expect(db.matching(/UPDATE "Article" SET title = \?/)[0].binds[6]).toBeNull()
    // … so the index must not be rewritten with an empty body.
    const fts = db.matching(/INSERT INTO "ArticleFts"/)
    expect(fts).toHaveLength(1)
    expect(fts[0].binds).toEqual([44, 'Retitled', 'About otters', 'The stored body about badgers .'])
  })

  it('records a second source’s copy of the same page as a read tombstone without a body', async () => {
    const db = ingestDb({ urlDup: { id: 30, source: 'x-bookmark' } })
    const bucket = fakeBucket()

    const { body } = await run(db, item, bucket)

    expect(body).toEqual({
      success: true, ingested: true, existing: false, duplicateUrl: true, duplicateOf: 'x-bookmark',
      article: { id: 50, url: item.url, feedId: 2 },
    })
    expect(db.matching(/INSERT OR IGNORE INTO "Article"/)[0].binds[10]).toBe(1) // is_read
    expect(bucket.objects.size).toBe(0)
    expect(db.matching(/"ArticleFts"/)).toHaveLength(0)
  })

  it('answers 400 for a body that fails validation and 401 for an unknown token', async () => {
    const { source, ...withoutSource } = item
    expect((await run(ingestDb(), withoutSource)).status).toBe(400)
    expect((await run(ingestDb(), { ...item, url: 'not a url' })).status).toBe(400)
    expect((await run(fakeD1(authAs(null)), item)).status).toBe(401)
  })
})
