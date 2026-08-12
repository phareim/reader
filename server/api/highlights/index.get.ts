import { getAuthenticatedUser } from '~/server/utils/auth'
import { getD1 } from '~/server/utils/cloudflare'

/**
 * GET /api/highlights — every marked passage the user owns, newest first,
 * joined with its article for the commonplace-book page (/highlights).
 * Optional `?q=` (min 2 chars) narrows to quotes/notes containing the term
 * (case-insensitive LIKE — highlights are not in the FTS index, and a
 * personal commonplace book is small enough that a scan is honest work);
 * optional `?limit=` caps the rows. The command palette uses both.
 */
export default defineEventHandler(async (event) => {
  const user = await getAuthenticatedUser(event)

  const q = String(getQuery(event).q || '').trim()
  const limitRaw = parseInt(String(getQuery(event).limit))
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 500) : 500

  let filterSql = ''
  const binds: (string | number)[] = []
  if (q.length >= 2) {
    const like = `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`
    filterSql = ` AND (h.quote LIKE ? ESCAPE '\\' OR h.note LIKE ? ESCAPE '\\')`
    binds.push(like, like)
  }

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
    WHERE h.user_id = ? AND f.user_id = ?${filterSql}
    ORDER BY h.created_at DESC, h.id DESC
    LIMIT ?
    `
  ).bind(user.id, user.id, ...binds, limit).all()

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
