import { getAuthenticatedUser } from '~/server/utils/auth'
import { getD1 } from '~/server/utils/cloudflare'
import { buildFtsQuery, SNIPPET_OPEN, SNIPPET_CLOSE } from '~/server/utils/searchIndex'

/**
 * GET /api/search?q=… — full-text search over the user's articles via
 * ArticleFts (title / summary / body), ranked by bm25 with the title
 * weighted heaviest. Each hit carries a body snippet with the matched
 * terms wrapped in private-use-area markers (the client HTML-escapes,
 * then swaps them for <mark> — see utils/searchRender.ts).
 */
export default defineEventHandler(async (event) => {
  const user = await getAuthenticatedUser(event)

  const q = String(getQuery(event).q || '').trim()
  const limit = Math.min(parseInt(String(getQuery(event).limit)) || 30, 100)
  if (q.length < 2) {
    return { results: [], query: q }
  }

  const match = buildFtsQuery(q)
  if (!match) {
    return { results: [], query: q }
  }

  try {
    const db = getD1(event)
    const result = await db.prepare(
      `
      SELECT
        a.id,
        a.feed_id,
        a.title,
        a.url,
        a.summary,
        a.image_url,
        a.published_at,
        a.is_read,
        f.title AS feed_title,
        snippet("ArticleFts", 2, '${SNIPPET_OPEN}', '${SNIPPET_CLOSE}', ' … ', 16) AS snippet,
        bm25("ArticleFts", 8.0, 3.0, 1.0) AS rank
      FROM "ArticleFts"
      JOIN "Article" a ON a.id = "ArticleFts".rowid
      JOIN "Feed" f ON f.id = a.feed_id
      WHERE "ArticleFts" MATCH ? AND f.user_id = ?
      ORDER BY rank
      LIMIT ?
      `
    ).bind(match, user.id, limit).all()

    return {
      query: q,
      results: (result.results || []).map((r: any) => ({
        id: r.id,
        feedId: r.feed_id,
        feedTitle: r.feed_title,
        title: r.title,
        url: r.url,
        summary: r.summary,
        imageUrl: r.image_url,
        publishedAt: r.published_at,
        isRead: Boolean(r.is_read),
        snippet: r.snippet || ''
      }))
    }
  } catch (error: any) {
    // An FTS syntax error from hostile input degrades to "no results", not a 500.
    if (/fts5|syntax/i.test(String(error.message))) {
      return { results: [], query: q }
    }
    throw createError({
      statusCode: 500,
      statusMessage: 'Search failed',
      message: error.message
    })
  }
})
