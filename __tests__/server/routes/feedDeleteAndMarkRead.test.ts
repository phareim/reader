/** @jest-environment node */
/**
 * DELETE /api/feeds/:id and POST /api/articles/mark-all-read on accounts
 * large enough to meet the platform caps: D1's 100 bound parameters per
 * statement and the Worker's 1000 subrequests per invocation (every D1
 * statement and every R2 call is one). D1 and R2 are fakes.
 */
import {
  fakeD1, fakeBucket, makeEvent, callHandler, authAs, SESSION_COOKIE, D1_MAX_BOUND_PARAMS,
} from '~/__tests__/mocks/nitro'
import deleteFeed from '~/server/api/feeds/[id].delete'
import markAllRead from '~/server/api/articles/mark-all-read.post'

const user = { id: 'user-1', email: 'petter@example.com', name: 'Petter' }

describe('DELETE /api/feeds/:id', () => {
  const ARTICLES = 600
  const setup = () => {
    const articles = Array.from({ length: ARTICLES }, (_, i) => ({ id: i + 1, content_key: `articles/${i + 1}.html` }))
    const stored: Record<string, string> = { 'notes/5.txt': 'a legacy note', 'articles/9999.html': 'another feed' }
    for (const a of articles) stored[a.content_key] = '<p>body</p>'
    const bucket = fakeBucket(stored)
    let bucketCalls = 0
    const countingBucket = {
      ...bucket,
      delete: async (keys: string | string[]) => { bucketCalls += 1; return bucket.delete(keys) },
    }
    const indexed = new Set(articles.map((a) => a.id))
    const db = fakeD1(authAs(user, (call) => {
      if (/SELECT id FROM "Feed" WHERE id = \? AND user_id = \?/.test(call.sql)) return { id: 3 }
      if (/SELECT id, content_key FROM "Article" WHERE feed_id = \?/.test(call.sql)) return articles
      if (/note_key/.test(call.sql)) {
        // Per-article lookup (article 5 carries the one legacy note) or one
        // lookup for the whole feed — either way the same single note.
        if (/WHERE article_id = \?$/.test(call.sql)) return call.binds[0] === 5 ? [{ note_key: 'notes/5.txt' }] : []
        return [{ note_key: 'notes/5.txt' }]
      }
      if (/DELETE FROM "ArticleFts"/.test(call.sql)) for (const id of call.binds) indexed.delete(id)
    }))
    return { db, bucket, countingBucket, indexed, bucketCalls: () => bucketCalls }
  }

  it('deletes a feed of several hundred articles inside one invocation’s subrequest budget', async () => {
    const { db, bucket, countingBucket, indexed, bucketCalls } = setup()

    const { status, body } = await callHandler(deleteFeed, makeEvent({
      method: 'DELETE', headers: SESSION_COOKIE, params: { id: '3' }, db, bucket: countingBucket as any,
    }))

    expect(status).toBe(200)
    expect(body).toEqual({ success: true, deletedArticles: ARTICLES })
    // Everything that belonged to the feed is gone; nothing else is touched.
    expect([...bucket.objects.keys()]).toEqual(['articles/9999.html'])
    expect(indexed.size).toBe(0)
    expect(db.matching(/DELETE FROM "Feed" WHERE id = \?/)[0].binds).toEqual([3])
    // One D1 statement or R2 call per article would be 1200 subrequests here.
    expect(db.calls.length + bucketCalls()).toBeLessThan(100)
  })

  it('answers 404 for a feed the caller does not own and deletes nothing', async () => {
    const db = fakeD1(authAs(user))
    const bucket = fakeBucket({ 'articles/1.html': 'x' })

    const { status } = await callHandler(deleteFeed, makeEvent({
      method: 'DELETE', headers: SESSION_COOKIE, params: { id: '3' }, db, bucket,
    }))

    expect(status).toBe(404)
    expect(bucket.objects.size).toBe(1)
    expect(db.matching(/DELETE/)).toHaveLength(0)
  })
})

describe('POST /api/articles/mark-all-read', () => {
  const run = (db: ReturnType<typeof fakeD1>, body: unknown) =>
    callHandler(markAllRead, makeEvent({ method: 'POST', headers: SESSION_COOKIE, body, db }))

  it('marks one feed’s unread articles read and reports the count', async () => {
    const db = fakeD1(authAs(user, (call) => {
      if (/SELECT id FROM "Feed" WHERE id = \? AND user_id = \?/.test(call.sql)) return { id: 3 }
      if (/SELECT COUNT\(\*\) AS total FROM "Article"/.test(call.sql)) return { total: 12 }
    }))

    const { status, body } = await run(db, { feedId: 3 })

    expect(status).toBe(200)
    expect(body).toEqual({ markedCount: 12 })
    const update = db.matching(/UPDATE "Article" SET is_read = 1, read_at = \?/)[0]
    expect(update.sql).toContain('feed_id IN (SELECT id FROM "Feed" WHERE user_id = ?) AND feed_id = ?')
    expect(update.binds.slice(1)).toEqual(['user-1', 3])
  })

  it('marks a tag’s articles read even when the tag holds more feeds than D1 binds in one statement', async () => {
    const db = fakeD1(authAs(user, (call) => {
      if (/SELECT id FROM "Tag" WHERE user_id = \? AND name = \? COLLATE NOCASE/.test(call.sql)) return { id: 8 }
      if (/FROM "FeedTag" ft JOIN "Feed" f/.test(call.sql)) return Array.from({ length: 120 }, (_, i) => ({ id: i + 1 }))
      if (/SELECT COUNT\(\*\) AS total FROM "Article"/.test(call.sql)) return { total: 40 }
    }))

    const { status, body } = await run(db, { tag: 'Tech' })

    expect(status).toBe(200)
    expect(body).toEqual({ markedCount: 40 })
    const update = db.matching(/UPDATE "Article" SET is_read = 1, read_at = \?/)[0]
    expect(update.binds.length).toBeLessThanOrEqual(D1_MAX_BOUND_PARAMS)
    const scoped = update.sql.match(/AND feed_id IN \(([\d,\s]+)\)/)![1].split(',')
    expect(scoped).toHaveLength(120)
  })

  it('marks nothing for an empty articleIds array', async () => {
    const db = fakeD1(authAs(user, (call) => (/COUNT\(\*\) AS total/.test(call.sql) ? { total: 4321 } : undefined)))

    const { status, body } = await run(db, { articleIds: [] })

    expect(status).toBe(200)
    expect(body).toEqual({ markedCount: 0 })
    expect(db.matching(/UPDATE "Article"/)).toHaveLength(0)
  })

  it('answers 404 for an unknown tag or feed', async () => {
    expect((await run(fakeD1(authAs(user)), { tag: 'nope' })).status).toBe(404)
    expect((await run(fakeD1(authAs(user)), { feedId: 99 })).status).toBe(404)
  })
})
