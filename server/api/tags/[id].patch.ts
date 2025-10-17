/**
 * PATCH /api/tags/[id]
 * Update a tag (rename or change color)
 */

import { getServerSession } from '#auth'
import prisma from '~/server/utils/db'
import { z } from 'zod'

const updateTagSchema = z.object({
  name: z.string().min(1).max(50).trim().optional(),
  color: z.string().nullable().optional()
})

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

  const body = await readBody(event)
  const validation = updateTagSchema.safeParse(body)

  if (!validation.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid request body',
      data: validation.error.issues
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

  const updateData: any = {}
  if (validation.data.name !== undefined) {
    updateData.name = validation.data.name
  }
  if (validation.data.color !== undefined) {
    updateData.color = validation.data.color
  }

  try {
    const updatedTag = await prisma.tag.update({
      where: { id: tagId },
      data: updateData
    })

    return updatedTag
  } catch (error: any) {
    // Handle unique constraint violation
    if (error.code === 'P2002') {
      throw createError({
        statusCode: 409,
        statusMessage: `Tag "${validation.data.name}" already exists`
      })
    }
    throw error
  }
})
