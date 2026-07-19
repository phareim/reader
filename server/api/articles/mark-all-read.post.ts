import { getAuthenticatedUser } from '~/server/utils/auth'
import { getD1 } from '~/server/utils/cloudflare'

export default defineEventHandler(async (event) => {
  const user = await getAuthenticatedUser(event)

  const body = await readBody(event)
  const { feedId, tag, articleIds } = body ?? {}

  const db = getD1(event)

  // If specific article IDs are provided, mark exactly those as read
  if (articleIds && Array.isArray(articleIds) && articleIds.length > 0) {
    const ids = articleIds.map(Number).filter(id => !Number.isNaN(id))
    if (ids.length === 0) {
      throw createError({ statusCode: 400, statusMessage: 'Invalid article IDs' })
    }

    try {
      const placeholders = ids.map(() => '?').join(',')
      // Verify ownership and mark as read
      const now = new Date().toISOString()
      const result = await db.prepare(
        `UPDATE "Article" SET is_read = 1, read_at = ?
         WHERE id IN (${placeholders})
           AND is_read = 0
           AND feed_id IN (SELECT id FROM "Feed" WHERE user_id = ?)`
      ).bind(now, ...ids, user.id).run()

      return { markedCount: result.meta?.changes || 0 }
    } catch (error: any) {
      if (error.statusCode) throw error
      throw createError({ statusCode: 500, statusMessage: 'Failed to mark articles as read', message: error.message })
    }
  }

  let targetFeedId: number | undefined
  // Feed ids for a tag-scoped mark-all (the grid on /TAG-NAME). Mirrors the
  // articles list endpoint: name match is ASCII case-insensitive, unknown
  // tag is a 404, a tag with no feeds marks nothing.
  let tagFeedIds: number[] | undefined

  if (feedId === undefined && typeof tag === 'string' && tag.trim()) {
    const tagRow = await db.prepare(
      'SELECT id FROM "Tag" WHERE user_id = ? AND name = ? COLLATE NOCASE'
    ).bind(user.id, tag.trim()).first<{ id: number }>()

    if (!tagRow) {
      throw createError({ statusCode: 404, statusMessage: 'Tag not found' })
    }

    const feedsResult = await db.prepare(
      'SELECT ft.feed_id AS id FROM "FeedTag" ft JOIN "Feed" f ON f.id = ft.feed_id WHERE ft.tag_id = ? AND f.user_id = ?'
    ).bind(tagRow.id, user.id).all()

    tagFeedIds = (feedsResult.results || []).map((row: any) => Number(row.id))
    if (tagFeedIds.length === 0) {
      return { markedCount: 0 }
    }
  }

  if (feedId !== undefined) {
    targetFeedId = Number(feedId)

    if (Number.isNaN(targetFeedId)) {
      throw createError({
        statusCode: 400,
        statusMessage: 'feedId must be a number'
      })
    }

    const feed = await db.prepare('SELECT id FROM "Feed" WHERE id = ? AND user_id = ?')
      .bind(targetFeedId, user.id)
      .first()

    if (!feed) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Feed not found'
      })
    }
  }

  try {
    const params: any[] = [user.id]
    let where = 'is_read = 0 AND feed_id IN (SELECT id FROM "Feed" WHERE user_id = ?)'

    if (targetFeedId !== undefined) {
      where += ' AND feed_id = ?'
      params.push(targetFeedId)
    } else if (tagFeedIds) {
      where += ` AND feed_id IN (${tagFeedIds.map(() => '?').join(',')})`
      params.push(...tagFeedIds)
    }

    const countResult = await db.prepare(
      `SELECT COUNT(*) AS total FROM "Article" WHERE ${where}`
    ).bind(...params).first()

    if (!countResult || Number(countResult.total) === 0) {
      return { markedCount: 0 }
    }

    await db.prepare(
      `UPDATE "Article" SET is_read = 1, read_at = ? WHERE ${where}`
    ).bind(new Date().toISOString(), ...params).run()

    return {
      markedCount: Number(countResult.total || 0)
    }
  } catch (error: any) {
    if (error.statusCode) {
      throw error
    }

    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to mark articles as read',
      message: error.message
    })
  }
})
