/**
 * GET /api/saved-articles/counts
 * Get saved article counts by tag (efficient server-side aggregation)
 */

import { getAuthenticatedUser } from '~/server/utils/auth'
import prisma from '~/server/utils/db'

export default defineEventHandler(async (event) => {
  const user = await getAuthenticatedUser(event)

  try {
    // Get total count and tag counts in a single efficient query
    const [totalCount, tagCounts, untaggedCount] = await Promise.all([
      // Total saved articles
      prisma.savedArticle.count({
        where: { userId: user.id }
      }),
      
      // Count by tag using raw aggregation
      prisma.$queryRaw<Array<{ name: string; count: bigint }>>`
        SELECT t.name, COUNT(sat."savedArticleId") as count
        FROM "Tag" t
        INNER JOIN "SavedArticleTag" sat ON sat."tagId" = t.id
        INNER JOIN "SavedArticle" sa ON sa.id = sat."savedArticleId"
        WHERE sa."userId" = ${user.id}
        GROUP BY t.id, t.name
        ORDER BY t.name
      `,
      
      // Untagged saved articles
      prisma.savedArticle.count({
        where: {
          userId: user.id,
          tags: { none: {} }
        }
      })
    ])

    // Convert bigint to number and build response
    const byTag: Record<string, { tag: string; count: number }> = {}
    
    for (const row of tagCounts) {
      byTag[row.name] = {
        tag: row.name,
        count: Number(row.count)
      }
    }

    // Add inbox for untagged
    if (untaggedCount > 0) {
      byTag['__inbox__'] = { tag: '__inbox__', count: untaggedCount }
    }

    return {
      total: totalCount,
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

