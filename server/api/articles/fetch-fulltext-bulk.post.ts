import { getAuthenticatedUser } from '~/server/utils/auth'
import { getD1 } from '~/server/utils/cloudflare'
import { fetchFullText, updateFullTextStatus } from '~/server/utils/fulltext'

export default defineEventHandler(async (event) => {
  const user = await getAuthenticatedUser(event)
  const body = await readBody(event)
  const { tag, limit = 20 } = body ?? {}

  if (!tag || typeof tag !== 'string') {
    throw createError({ statusCode: 400, statusMessage: 'tag is required' })
  }

  const articleLimit = Math.min(Math.max(1, Number(limit) || 20), 50)
  const db = getD1(event)

  // Get feed IDs for this tag
  const tagFeeds = await db.prepare(
    `SELECT ft.feed_id
     FROM "FeedTag" ft
     JOIN "Tag" t ON t.id = ft.tag_id
     WHERE t.user_id = ? AND t.name = ?`
  ).bind(user.id, tag).all()

  const feedIds = (tagFeeds.results || []).map((row: any) => row.feed_id)
  if (feedIds.length === 0) {
    return { results: [] }
  }

  // Get pending articles under this tag
  const placeholders = feedIds.map(() => '?').join(',')
  const articles = await db.prepare(
    `SELECT a.id, a.url
     FROM "Article" a
     WHERE a.feed_id IN (${placeholders})
       AND a.full_text_status = 'pending'
     ORDER BY a.published_at DESC
     LIMIT ?`
  ).bind(...feedIds, articleLimit).all()

  const rows = articles.results || []
  const results: { articleId: number; status: string; error?: string }[] = []

  // Sequential fetching to be polite to source servers
  for (const row of rows) {
    const result = await fetchFullText(event, { id: row.id as number, url: row.url as string })
    if (result.status !== 'fetched') {
      await updateFullTextStatus(event, row.id as number, result.status, result.error)
    }
    results.push({
      articleId: row.id as number,
      status: result.status,
      error: result.error
    })
  }

  return { results }
})
