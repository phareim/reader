import { getAuthenticatedUser } from '~/server/utils/auth'
import { getD1 } from '~/server/utils/cloudflare'

/**
 * GET /api/highlights — every marked passage the user owns, newest first,
 * joined with its article for the commonplace-book page (/highlights).
 */
export default defineEventHandler(async (event) => {
  const user = await getAuthenticatedUser(event)

  const db = getD1(event)
  const result = await db.prepare(
    `
    SELECT
      h.id, h.article_id, h.sfl_idea_id, h.quote, h.note, h.created_at,
      a.title AS article_title, a.url AS article_url,
      f.title AS feed_title
    FROM "Highlight" h
    JOIN "Article" a ON a.id = h.article_id
    JOIN "Feed" f ON f.id = a.feed_id
    WHERE h.user_id = ? AND f.user_id = ?
    ORDER BY h.created_at DESC, h.id DESC
    `
  ).bind(user.id, user.id).all()

  const highlights = (result.results || []).map((r: any) => ({
    id: r.id,
    articleId: r.article_id,
    articleTitle: r.article_title,
    articleUrl: r.article_url,
    feedTitle: r.feed_title,
    sflIdeaId: r.sfl_idea_id,
    quote: r.quote,
    note: r.note,
    createdAt: r.created_at,
  }))

  return { highlights }
})
