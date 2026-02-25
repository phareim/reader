/**
 * GET /api/saved-articles/counts
 * Get saved article counts by tag (efficient server-side aggregation)
 */

import { getAuthenticatedUser } from '~/server/utils/auth'
import { getD1 } from '~/server/utils/cloudflare'

export default defineEventHandler(async (event) => {
  const user = await getAuthenticatedUser(event)

  try {
    const db = getD1(event)

    const [totalCountResult, tagCountsResult, untaggedCountResult] = await Promise.all([
      db.prepare('SELECT COUNT(*) AS total FROM "SavedArticle" WHERE user_id = ?')
        .bind(user.id)
        .first(),
      db.prepare(
        `
        SELECT t.name, COUNT(*) AS count
        FROM "SavedArticleTag" sat
        JOIN "Tag" t ON t.id = sat.tag_id
        WHERE t.user_id = ?
        GROUP BY t.name
        `
      ).bind(user.id).all(),
      db.prepare(
        `
        SELECT COUNT(*) AS total
        FROM "SavedArticle" sa
        WHERE sa.user_id = ?
          AND NOT EXISTS (
            SELECT 1 FROM "SavedArticleTag" sat WHERE sat.saved_article_id = sa.id
          )
        `
      ).bind(user.id).first()
    ])

    const untaggedCount = Number(untaggedCountResult?.total || 0)

    // Build response
    const byTag: Record<string, { tag: string; count: number }> = {}

    for (const row of tagCountsResult.results || []) {
      byTag[row.name] = {
        tag: row.name,
        count: Number(row.count || 0)
      }
    }

    // Add inbox for untagged
    if (untaggedCount > 0) {
      byTag['__inbox__'] = { tag: '__inbox__', count: untaggedCount }
    }

    return {
      total: Number(totalCountResult?.total || 0),
      byTag,
      tags: Object.keys(byTag).filter(t => t !== '__inbox__').sort()
    }
  } catch (error: any) {
    console.error('Failed to fetch saved article counts:', error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to fetch saved article counts',
      message: error.message
    })
  }
})
