/**
 * GET /api/tags
 * Get all tags for the authenticated user
 */

import { getAuthenticatedUser } from '~/server/utils/auth'
import { getD1 } from '~/server/utils/cloudflare'

export default defineEventHandler(async (event) => {
  const user = await getAuthenticatedUser(event)
  const db = getD1(event)

  const tagsResult = await db.prepare(
    `
    SELECT
      t.id,
      t.name,
      t.color,
      t.created_at,
      (SELECT COUNT(*) FROM "FeedTag" ft WHERE ft.tag_id = t.id) AS feed_count,
      (SELECT COUNT(*) FROM "SavedArticleTag" sat WHERE sat.tag_id = t.id) AS saved_article_count
    FROM "Tag" t
    WHERE t.user_id = ?
    ORDER BY t.name ASC
    `
  ).bind(user.id).all()

  return (tagsResult.results || []).map((tag: any) => ({
    id: tag.id,
    name: tag.name,
    color: tag.color,
    createdAt: tag.created_at,
    feedCount: Number(tag.feed_count || 0),
    savedArticleCount: Number(tag.saved_article_count || 0)
  }))
})
