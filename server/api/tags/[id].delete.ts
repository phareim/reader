/**
 * DELETE /api/tags/[id]
 * Delete a tag (and all its associations)
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

  const tagId = parseInt(event.context.params?.id || '')
  if (isNaN(tagId)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid tag ID'
    })
  }

  // Verify tag belongs to user
  const existingTag = await prisma.tag.findFirst({
    where: {
      id: tagId,
      userId: user.id
    }
  })

  if (!existingTag) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Tag not found'
    })
  }

  // Delete the tag (cascade will handle FeedTag and SavedArticleTag)
  await prisma.tag.delete({
    where: { id: tagId }
  })

  return { success: true }
})
