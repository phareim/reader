/** @jest-environment node */
/**
 * The read routes MCP-token clients use (the bundled MCP server, Arbeidsbok,
 * the Sleeper-side scripts): GET /api/feeds, /api/articles, /api/articles/:id
 * and /api/search. Response shapes are pinned as this repo defines them.
 */
import {
  fakeD1, fakeBucket, makeEvent, callHandler, authAs, MCP_HEADER, D1_MAX_BOUND_PARAMS,
} from '~/__tests__/mocks/nitro'
import listFeeds from '~/server/api/feeds/index.get'
import listArticles from '~/server/api/articles/index.get'
import getArticle from '~/server/api/articles/[id].get'
import search from '~/server/api/search.get'

const user = { id: 'user-1', email: 'petter@example.com', name: 'Petter' }

const articleRow = (id: number) => ({
  id, feed_id: 3, guid: `g${id}`, title: `Article ${id}`, url: `https://example.com/${id}`,
  author: null, summary: 'S', image_url: null, full_text_status: 'pending',
  published_at: '2026-11-20T08:00:00.000Z', is_read: 0, is_starred: 0, read_at: null,
  read_progress: 0, feed_title: 'A feed', feed_favicon: null,
})

/** A user with `feedCount` feeds; the article query answers `rows`. */
const listDb = (feedCount: number, rows: any[] = []) =>
  fakeD1(authAs(user, (call) => {
    if (/^SELECT id FROM "Feed" WHERE user_id = \?$/.test(call.sql)) {
      return Array.from({ length: feedCount }, (_, i) => ({ id: i + 1 }))
    }
    if (/FROM "Article" a JOIN "Feed" f/.test(call.sql)) return rows
  }))

const get = (handler: any, db: ReturnType<typeof fakeD1>, url: string, extra: Record<string, any> = {}) =>
  callHandler(handler, makeEvent({ url, headers: MCP_HEADER, db, bucket: fakeBucket(), ...extra }))

describe('GET /api/articles', () => {
  it('answers { articles, hasMore } and learns hasMore from one extra row', async () => {
    const db = listDb(2, [articleRow(1), articleRow(2), articleRow(3)])

    const { status, body } = await get(listArticles, db, '/api/articles?isRead=false&limit=2')

    expect(status).toBe(200)
    expect(Object.keys(body).sort()).toEqual(['articles', 'hasMore'])
    expect(body.hasMore).toBe(true)
    expect(body.articles).toHaveLength(2)
    expect(body.articles[0]).toEqual({
      id: 1, feedId: 3, feedTitle: 'A feed', feedFavicon: null, guid: 'g1', title: 'Article 1',
      url: 'https://example.com/1', author: null, content: null, summary: 'S', imageUrl: null,
      fullTextStatus: 'pending', publishedAt: '2026-11-20T08:00:00.000Z', isRead: false,
      isStarred: false, readAt: null, readProgress: 0,
    })
    const query = db.matching(/FROM "Article" a JOIN "Feed" f/)[0]
    // feed ids, is_read, LIMIT (limit + 1), OFFSET
    expect(query.binds).toEqual([1, 2, 0, 3, 0])
  })

  it('never passes a negative limit through to SQL (LIMIT -n means "no limit" in SQLite)', async () => {
    const db = listDb(1, [articleRow(1)])

    const { body } = await get(listArticles, db, '/api/articles?limit=-5')

    const query = db.matching(/FROM "Article" a JOIN "Feed" f/)[0]
    const sqlLimit = query.binds[query.binds.length - 2]
    expect(sqlLimit).toBeGreaterThanOrEqual(2)
    expect(body.articles).toHaveLength(1)
    expect(body.hasMore).toBe(false)
  })

  it('caps the page at 200 rows', async () => {
    const db = listDb(1)
    await get(listArticles, db, '/api/articles?limit=5000')
    const query = db.matching(/FROM "Article" a JOIN "Feed" f/)[0]
    expect(query.binds[query.binds.length - 2]).toBe(201)
  })

  it('still lists articles for an account with more feeds than D1 binds in one statement', async () => {
    const db = listDb(120, [articleRow(1)])

    const { status, body } = await get(listArticles, db, '/api/articles?isRead=false&excludeSaved=true&decay=true')

    expect(status).toBe(200)
    expect(body.articles).toHaveLength(1)
    const query = db.matching(/FROM "Article" a JOIN "Feed" f/)[0]
    expect(query.binds.length).toBeLessThanOrEqual(D1_MAX_BOUND_PARAMS)
    // Every one of the 120 feeds is still in scope.
    const inList = query.sql.match(/a\.feed_id IN \(([^)]*)\)/)![1].split(',').map((s) => s.trim())
    expect(inList).toHaveLength(120)
    expect(inList[0]).toBe('1')
    expect(inList[119]).toBe('120')
  })

  it('answers 404 for an unknown feed or tag and 401 without auth', async () => {
    expect((await get(listArticles, fakeD1(authAs(user)), '/api/articles?feedId=99')).status).toBe(404)
    expect((await get(listArticles, fakeD1(authAs(user)), '/api/articles?tag=nope')).status).toBe(404)
    expect((await get(listArticles, fakeD1(authAs(null)), '/api/articles')).status).toBe(401)
  })
})

describe('GET /api/feeds', () => {
  it('answers { feeds } with unread counts, tags and sync health', async () => {
    const db = fakeD1(authAs(user, (call) => {
      if (/FROM "Feed" WHERE user_id = \? ORDER BY created_at ASC/.test(call.sql)) {
        return [{
          id: 3, title: 'A feed', url: 'https://example.com/feed.xml', description: null,
          site_url: 'https://example.com', favicon_url: null, last_fetched_at: '2026-11-21T09:00:00.000Z',
          last_error: null, error_count: 0, is_active: 1, kind: 'rss', half_life_hours: null,
          created_at: '2026-01-01 00:00:00', newest_article_at: '2026-11-20T08:00:00.000Z',
        }]
      }
      if (/COUNT\(\*\) AS unread_count/.test(call.sql)) return [{ feed_id: 3, unread_count: 4 }]
      if (/FROM "FeedTag" ft JOIN "Tag" t/.test(call.sql)) return [{ feed_id: 3, tag_name: 'tech' }, { feed_id: 3, tag_name: 'ai' }]
    }))

    const { status, body } = await get(listFeeds, db, '/api/feeds')

    expect(status).toBe(200)
    expect(body).toEqual({
      feeds: [{
        id: 3, title: 'A feed', url: 'https://example.com/feed.xml', description: null,
        siteUrl: 'https://example.com', faviconUrl: null, tags: ['ai', 'tech'], unreadCount: 4,
        lastFetchedAt: '2026-11-21T09:00:00.000Z', lastError: null, errorCount: 0,
        newestArticleAt: '2026-11-20T08:00:00.000Z', isActive: true, kind: 'rss', halfLifeHours: null,
      }],
    })
  })
})

describe('GET /api/articles/:id', () => {
  const row = {
    ...articleRow(7), content_key: 'articles/7.html', feed_user_id: 'user-1', feed_kind: 'rss',
    feed_favicon_url: null,
  }
  const articleDb = (owner: string) => fakeD1(authAs(user, (call) => {
    if (/SELECT a\.\*, f\.id AS feed_id/.test(call.sql)) return [{ ...row, feed_user_id: owner }]
  }))

  it('answers the article with its stored body', async () => {
    const bucket = fakeBucket({ 'articles/7.html': '<p>Body</p>' })

    const { status, body } = await get(getArticle, articleDb('user-1'), '/api/articles/7', { params: { id: '7' }, bucket })

    expect(status).toBe(200)
    expect(body).toMatchObject({
      id: 7, title: 'Article 7', url: 'https://example.com/7', content: '<p>Body</p>', summary: 'S',
      isRead: false, readProgress: 0, fullTextStatus: 'pending', feedId: 3, feedTitle: 'A feed',
      feedKind: 'rss', isGoodRead: false, note: null, tags: [],
    })
  })

  it('answers 404 for another user’s article, as if it did not exist', async () => {
    const { status } = await get(getArticle, articleDb('user-2'), '/api/articles/7', { params: { id: '7' } })
    expect(status).toBe(404)
  })
})

describe('GET /api/search', () => {
  it('answers { query, results } and never passes a negative limit to SQL', async () => {
    const db = fakeD1(authAs(user, (call) => {
      if (/FROM "ArticleFts"/.test(call.sql)) {
        return [{ ...articleRow(1), snippet: 'an otter swims', rank: -1 }]
      }
    }))

    const { body } = await get(search, db, '/api/search?q=otter&limit=-1')

    expect(body.query).toBe('otter')
    expect(body.results[0]).toEqual({
      id: 1, feedId: 3, feedTitle: 'A feed', title: 'Article 1', url: 'https://example.com/1',
      summary: 'S', imageUrl: null, publishedAt: '2026-11-20T08:00:00.000Z', isRead: false,
      snippet: 'an otter swims',
    })
    const query = db.matching(/FROM "ArticleFts"/)[0]
    expect(query.binds.slice(0, 2)).toEqual(['"otter"*', 'user-1'])
    expect(query.binds[2]).toBeGreaterThanOrEqual(1)
  })
})
