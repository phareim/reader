/**
 * GET /api/tags
 * Get all tags for the authenticated user
 */

import { getServerSession } from '#auth'
import prisma from '~/server/utils/db'

export default defineEventHandler(async (event) => {
  const session = await getServerSession(event)
  if (!session?.user?.email) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized'
    })
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email }
  })

  if (!user) {
    throw createError({
      statusCode: 404,
      statusMessage: 'User not found'
    })
  }

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
