/**
 * PATCH /api/tags/[id]
 * Update a tag (rename or change color)
 */

import { getAuthenticatedUser } from '~/server/utils/auth'
import { getD1 } from '~/server/utils/cloudflare'
import { z } from 'zod'

const updateTagSchema = z.object({
  name: z.string().min(1).max(50).trim().optional(),
  color: z.string().nullable().optional()
})

export default defineEventHandler(async (event) => {
  const user = await getAuthenticatedUser(event)
  const db = getD1(event)

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

  const existingTag = await db.prepare(
    'SELECT id FROM "Tag" WHERE id = ? AND user_id = ?'
  ).bind(tagId, user.id).first()

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
    const updates: string[] = []
    const params: any[] = []

    if (updateData.name !== undefined) {
      updates.push('name = ?')
      params.push(updateData.name)
    }

    if (updateData.color !== undefined) {
      updates.push('color = ?')
      params.push(updateData.color)
    }

    if (updates.length > 0) {
      await db.prepare(
        `
        UPDATE "Tag"
        SET ${updates.join(', ')}
        WHERE id = ? AND user_id = ?
        `
      ).bind(...params, tagId, user.id).run()
    }

    const updatedTag = await db.prepare(
      `
      SELECT id, user_id, name, color, created_at
      FROM "Tag"
      WHERE id = ?
      `
    ).bind(tagId).first()

    if (!updatedTag) {
      throw createError({
        statusCode: 500,
        message: 'Failed to update tag'
      })
    }

    return {
      id: updatedTag.id,
      userId: updatedTag.user_id,
      name: updatedTag.name,
      color: updatedTag.color,
      createdAt: updatedTag.created_at
    }
  } catch (error: any) {
    if (error.statusCode) {
      throw error
    }
    if (error.message?.toLowerCase().includes('unique')) {
      throw createError({
        statusCode: 409,
        statusMessage: `Tag "${validation.data.name}" already exists`
      })
    }
    throw createError({
      statusCode: 500,
      message: error.message
    })
  }
})
