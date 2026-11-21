/** @jest-environment node */
/**
 * The two write routes Arbeidsbok calls with `X-MCP-Token`:
 * POST /api/articles/manual and POST /api/articles/:id/fetch-fulltext.
 * Request and response shapes are pinned as this repo's code defines them;
 * D1/R2 are fakes and the fetched page is a hand-written fixture.
 */
import {
  fakeD1, fakeBucket, makeEvent, callHandler, mockFetch, authAs, MCP_HEADER,
} from '~/__tests__/mocks/nitro'
import addManual from '~/server/api/articles/manual.post'
import fetchFulltext from '~/server/api/articles/[id]/fetch-fulltext.post'

const user = { id: 'user-1', email: 'petter@example.com', name: 'Petter' }

let net: ReturnType<typeof mockFetch>
afterEach(() => net?.restore())

describe('POST /api/articles/manual', () => {
  const body = {
    title: 'A found article',
    url: 'https://example.com/found',
    content: '<p>Body</p>',
    summary: 'Short',
    author: 'Someone',
    tags: ['work'],
  }

  const manualDb = (opts: { feedExists?: boolean; articleExists?: boolean } = {}) =>
    fakeD1(authAs(user, (call) => {
      if (/SELECT id FROM "Feed" WHERE user_id = \? AND url = \?/.test(call.sql)) return opts.feedExists ? { id: 3 } : null
      if (/INSERT INTO "Feed"/.test(call.sql)) return { meta: { changes: 1, last_row_id: 3 } }
      if (/INSERT OR IGNORE INTO "Article"/.test(call.sql)) {
        return opts.articleExists ? { meta: { changes: 0, last_row_id: 0 } } : { meta: { changes: 1, last_row_id: 41 } }
      }
      if (/SELECT id FROM "Article" WHERE feed_id = \? AND guid = \?/.test(call.sql)) return { id: 40 }
      if (/SELECT id, saved_at FROM "SavedArticle"/.test(call.sql)) return { id: 9, saved_at: '2026-11-21T10:00:00.000Z' }
      if (/SELECT id FROM "Tag" WHERE user_id = \? AND name = \?/.test(call.sql)) return { id: 5 }
    }))

  it('creates the manual feed on first use, stores the article, saves and tags it', async () => {
    const db = manualDb()
    const bucket = fakeBucket()

    const { status, body: out } = await callHandler(addManual, makeEvent({ method: 'POST', headers: MCP_HEADER, body, db, bucket }))

    expect(status).toBe(200)
    expect(out).toEqual({
      success: true,
      article: { id: 41, title: 'A found article', url: 'https://example.com/found', savedAt: '2026-11-21T10:00:00.000Z' },
      tags: ['work'],
    })

    const feedInsert = db.matching(/INSERT INTO "Feed"/)[0]
    expect(feedInsert.sql).toContain(`'manual'`)
    expect(feedInsert.binds.slice(0, 3)).toEqual(['user-1', 'manual://user-1', 'Manual Additions'])
    // The article's guid is its URL, so a second POST of the same URL is a no-op.
    const articleInsert = db.matching(/INSERT OR IGNORE INTO "Article"/)[0]
    expect(articleInsert.binds.slice(0, 4)).toEqual([3, 'https://example.com/found', 'A found article', 'https://example.com/found'])
    expect(bucket.objects.get('articles/41.html')).toBe('<p>Body</p>')
    expect(db.matching(/INSERT OR IGNORE INTO "SavedArticle"/)[0].binds.slice(0, 2)).toEqual(['user-1', 41])
    expect(db.matching(/INSERT OR IGNORE INTO "SavedArticleTag"/)[0].binds.slice(0, 2)).toEqual([9, 5])
  })

  it('answers with the existing article when the URL was added before', async () => {
    const db = manualDb({ feedExists: true, articleExists: true })

    const { status, body: out } = await callHandler(addManual, makeEvent({ method: 'POST', headers: MCP_HEADER, body, db, bucket: fakeBucket() }))

    expect(status).toBe(200)
    expect(out.article.id).toBe(40)
    expect(db.matching(/INSERT INTO "Feed"/)).toHaveLength(0)
  })

  it('answers 400 with the validation issues for a body without a url', async () => {
    const db = manualDb()

    const { status, statusMessage, body: issues } = await callHandler(addManual, makeEvent({
      method: 'POST', headers: MCP_HEADER, body: { title: 'No url' }, db, bucket: fakeBucket(),
    }))

    expect(status).toBe(400)
    expect(statusMessage).toBe('Invalid request body')
    expect(issues[0].path).toEqual(['url'])
    expect(db.matching(/INSERT/)).toHaveLength(0)
  })

  it('answers 401 for an unknown MCP token', async () => {
    const { status } = await callHandler(addManual, makeEvent({
      method: 'POST', headers: MCP_HEADER, body, db: fakeD1(authAs(null)), bucket: fakeBucket(),
    }))
    expect(status).toBe(401)
  })
})

describe('POST /api/articles/:id/fetch-fulltext', () => {
  const paragraph = 'The quick brown fox jumps over the lazy dog and keeps running through the long field. '
  const page = `<!doctype html><html><head><title>Long read</title>
    <meta property="og:image" content="https://example.com/lead.jpg"></head>
    <body><article><h1>Long read</h1>${`<p>${paragraph.repeat(6)}</p>`.repeat(6)}</article></body></html>`

  const articleDb = (row: Record<string, any> | null, imageUrl: string | null = 'https://example.com/lead.jpg') =>
    fakeD1(authAs(user, (call) => {
      if (/SELECT a\.id, a\.url, a\.full_text_status, a\.content_key, f\.kind AS feed_kind/.test(call.sql)) return row
      if (/SELECT image_url FROM "Article"/.test(call.sql)) return { image_url: imageUrl }
      if (/UPDATE "ArticleFts" SET body/.test(call.sql)) return { meta: { changes: 1 } }
    }))
  const rssArticle = { id: 7, url: 'https://example.com/long-read', full_text_status: 'pending', content_key: null, feed_kind: 'rss' }
  const run = (db: ReturnType<typeof fakeD1>, bucket = fakeBucket()) =>
    callHandler(fetchFulltext, makeEvent({ method: 'POST', headers: MCP_HEADER, params: { id: '7' }, db, bucket }))

  it('fetches the page, stores the readable body and answers { status, imageUrl, error }', async () => {
    net = mockFetch((call) => (call.url === 'https://example.com/long-read'
      ? new Response(page, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } })
      : undefined))
    const db = articleDb(rssArticle)
    const bucket = fakeBucket()

    const { status, body } = await run(db, bucket)

    expect(status).toBe(200)
    expect(body).toEqual({ status: 'fetched', imageUrl: 'https://example.com/lead.jpg', error: undefined })
    expect(bucket.objects.get('articles/7.html')).toContain('The quick brown fox')
    const update = db.matching(/UPDATE "Article" SET full_text_status = 'fetched'/)[0]
    expect(update.binds).toEqual(['articles/7.html', 'https://example.com/lead.jpg', 7])
  })

  it('reports a page that does not answer 200 as skipped and records why', async () => {
    net = mockFetch(() => new Response('gone', { status: 404, headers: { 'content-type': 'text/html' } }))
    const db = articleDb(rssArticle)

    const { body } = await run(db)

    expect(body).toEqual({ status: 'skipped', imageUrl: null, error: 'HTTP 404' })
    expect(db.matching(/UPDATE "Article" SET full_text_status = \?, full_text_error = \?/)[0].binds).toEqual(['skipped', 'HTTP 404', 7])
  })

  it('reports a network failure as failed', async () => {
    net = mockFetch(() => { throw new TypeError('fetch failed') })
    const { body } = await run(articleDb(rssArticle))
    expect(body).toEqual({ status: 'failed', imageUrl: null, error: 'Fetch error: fetch failed' })
  })

  it('never fetches for a Found item: its stored body is the article', async () => {
    net = mockFetch(() => new Response(page, { status: 200, headers: { 'content-type': 'text/html' } }))
    const db = articleDb({ ...rssArticle, feed_kind: 'found' })

    const { body } = await run(db)

    expect(body).toEqual({ status: 'skipped', imageUrl: null, error: 'Found items are complete as delivered' })
    expect(net.calls).toHaveLength(0)
  })

  it('answers 404 for an article the caller does not own and 401 without auth', async () => {
    net = mockFetch(() => undefined)
    expect((await run(articleDb(null))).status).toBe(404)
    expect((await run(fakeD1(authAs(null)))).status).toBe(401)
    expect(net.calls).toHaveLength(0)
  })
})
