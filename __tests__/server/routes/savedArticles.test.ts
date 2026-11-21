/** @jest-environment node */
/** GET /api/saved-articles — the shelf list the MCP server and the workbook read. */
import { fakeD1, makeEvent, callHandler, authAs, MCP_HEADER } from '~/__tests__/mocks/nitro'
import savedList from '~/server/api/saved-articles/index.get'

const user = { id: 'user-1', email: 'petter@example.com', name: 'Petter' }

describe('GET /api/saved-articles', () => {
  it('keeps a tag name that contains a comma whole, in the same answer shape', async () => {
    const db = fakeD1(authAs(user, (call) => {
      if (/FROM "SavedArticle" sa/.test(call.sql)) {
        return [
          { saved_id: 9, saved_at: '2026-11-21', article_id: 7, feed_id: 3, title: 'T', url: 'https://example.com/7',
            author: null, summary: null, image_url: null, published_at: null, is_read: 0, feed_title: 'F',
            feed_favicon: null, tags: '["work","a, b"]' },
          { saved_id: 10, saved_at: '2026-11-20', article_id: 8, feed_id: 3, title: 'U', url: 'https://example.com/8',
            author: null, summary: null, image_url: null, published_at: null, is_read: 1, feed_title: 'F',
            feed_favicon: null, tags: '[]' },
        ]
      }
    }))

    const { status, body } = await callHandler(savedList, makeEvent({ url: '/api/saved-articles', headers: MCP_HEADER, db }))

    expect(status).toBe(200)
    expect(body.articles[0]).toEqual({
      id: 7, feedId: 3, feedTitle: 'F', feedFavicon: null, title: 'T', url: 'https://example.com/7',
      author: null, content: null, summary: null, imageUrl: null, publishedAt: null, isRead: false,
      savedAt: '2026-11-21', savedId: 9, tags: ['a, b', 'work'],
    })
    expect(body.articles[1].tags).toEqual([])
    expect(db.matching(/FROM "SavedArticle" sa/)[0].sql).toContain('json_group_array(DISTINCT t.name)')
  })
})
