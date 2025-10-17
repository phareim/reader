/**
 * POST /api/tags
 * Create a new tag for the authenticated user
 */

import { getServerSession } from '#auth'
import prisma from '~/server/utils/db'
import { z } from 'zod'

const createTagSchema = z.object({
  name: z.string().min(1).max(50).trim(),
  color: z.string().optional()
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

  const body = await readBody(event)
  const validation = createTagSchema.safeParse(body)

  if (!validation.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid request body',
      data: validation.error.issues
    })
  }

  const { name, color } = validation.data

  try {
    const tag = await prisma.tag.create({
      data: {
        userId: user.id,
        name,
        color
      }
    })

    return tag
  } catch (error: any) {
    // Handle unique constraint violation
    if (error.code === 'P2002') {
      throw createError({
        statusCode: 409,
        statusMessage: `Tag "${name}" already exists`
      })
    }
    throw error
  }
})
