/**
 * GET /api/tags
 * Get all tags for the authenticated user
 */

import { getAuthenticatedUser } from '~/server/utils/auth'
import prisma from '~/server/utils/db'

export default defineEventHandler(async (event) => {
  const user = await getAuthenticatedUser(event)

  const tags = await prisma.tag.findMany({
    where: {
      userId: user.id
    },
    include: {
      _count: {
        select: {
          feeds: true,
          savedArticles: true
        }
      }
    },
    orderBy: {
      name: 'asc'
    }
  })

  return tags.map(tag => ({
    id: tag.id,
    name: tag.name,
    color: tag.color,
    createdAt: tag.createdAt,
    feedCount: tag._count.feeds,
    savedArticleCount: tag._count.savedArticles
  }))
})
