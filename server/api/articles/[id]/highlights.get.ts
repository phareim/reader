import { getAuthenticatedUser } from '~/server/utils/auth'
import { getD1 } from '~/server/utils/cloudflare'

/** List a user's highlights for one article, ordered for left-to-right paint. */
export default defineEventHandler(async (event) => {
  const user = await getAuthenticatedUser(event)

  const articleId = parseInt(getRouterParam(event, 'id') || '')
  if (isNaN(articleId)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid article ID' })
  }

  const db = getD1(event)
  const result = await db.prepare(
    `
    SELECT h.id, h.sfl_idea_id, h.quote, h.note, h.start_offset, h.end_offset, h.created_at
    FROM "Highlight" h
    JOIN "Article" a ON a.id = h.article_id
    JOIN "Feed" f ON f.id = a.feed_id
    WHERE h.article_id = ? AND h.user_id = ? AND f.user_id = ?
    ORDER BY h.start_offset ASC, h.id ASC
    `
  ).bind(articleId, user.id, user.id).all()

  const highlights = (result.results || []).map((r: any) => ({
    id: r.id,
    sflIdeaId: r.sfl_idea_id,
    quote: r.quote,
    note: r.note,
    startOffset: r.start_offset,
    endOffset: r.end_offset,
    createdAt: r.created_at,
  }))

  return { highlights }
})
