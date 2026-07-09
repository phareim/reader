import { H3Event } from 'h3'
import { getD1 } from '~/server/utils/cloudflare'
import { lastRowId } from '~/server/utils/d1Result'

/**
 * Resolve (or lazily create) a user's single Found feed — the push-only
 * bucket social collectors and the X bookmark sync insert into.
 * Shared by POST /api/ingest and /api/internal/sync-x-bookmarks.
 */
export async function resolveFoundFeed(event: H3Event, userId: string): Promise<number> {
  const db = getD1(event)
  const foundFeedUrl = `found://${userId}`

  let feed = await db.prepare(
    `SELECT id FROM "Feed" WHERE user_id = ? AND kind = 'found'`
  ).bind(userId).first<{ id: number }>()

  if (!feed) {
    const insertFeed = await db.prepare(
      `
      INSERT INTO "Feed" (user_id, url, title, description, kind, last_fetched_at, is_active)
      VALUES (?, ?, ?, ?, 'found', ?, 0)
      ON CONFLICT(user_id, url) DO UPDATE SET kind = 'found'
      `
    ).bind(
      userId,
      foundFeedUrl,
      'Found',
      'Bookmarks and saves collected from across the web',
      new Date().toISOString()
    ).run()

    const newId = lastRowId(insertFeed)
    feed = newId
      ? { id: newId }
      : await db.prepare(`SELECT id FROM "Feed" WHERE user_id = ? AND url = ?`)
          .bind(userId, foundFeedUrl).first<{ id: number }>()
  }

  if (!feed?.id) {
    throw new Error('Failed to resolve Found feed')
  }
  return Number(feed.id)
}
