/**
 * POST /api/tags
 * Create a new tag for the authenticated user
 */

import { getAuthenticatedUser } from '~/server/utils/auth'
import { getD1 } from '~/server/utils/cloudflare'
import { z } from 'zod'

const createTagSchema = z.object({
  name: z.string().min(1).max(50).trim(),
  color: z.string().optional()
})

export default defineEventHandler(async (event) => {
  const user = await getAuthenticatedUser(event)
  const db = getD1(event)

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
    await db.prepare(
      `
      INSERT INTO "Tag" (user_id, name, color)
      VALUES (?, ?, ?)
      `
    ).bind(user.id, name, color || null).run()

    const tag = await db.prepare(
      `
      SELECT id, user_id, name, color, created_at
      FROM "Tag"
      WHERE user_id = ? AND name = ?
      `
    ).bind(user.id, name).first()

    if (!tag) {
      throw createError({
        statusCode: 500,
        message: 'Failed to create tag'
      })
    }

    return {
      id: tag.id,
      userId: tag.user_id,
      name: tag.name,
      color: tag.color,
      createdAt: tag.created_at
    }
  } catch (error: any) {
    if (error.statusCode) {
      throw error
    }
    if (error.message?.toLowerCase().includes('unique')) {
      throw createError({
        statusCode: 409,
        statusMessage: `Tag "${name}" already exists`
      })
    }
    throw createError({
      statusCode: 500,
      message: error.message
    })
  }
})
