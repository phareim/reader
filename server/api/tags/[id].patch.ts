/**
 * PATCH /api/tags/[id]
 * Update a tag (rename or change color)
 */

import { getAuthenticatedUser } from '~/server/utils/auth'
import { getSupabaseClient } from '~/server/utils/supabase'
import { z } from 'zod'

const updateTagSchema = z.object({
  name: z.string().min(1).max(50).trim().optional(),
  color: z.string().nullable().optional()
})

export default defineEventHandler(async (event) => {
  const user = await getAuthenticatedUser(event)
  const supabase = getSupabaseClient(event)

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
  const { data: existingTag, error: findError } = await supabase
    .from('Tag')
    .select('id')
    .eq('id', tagId)
    .eq('user_id', user.id)
    .single()

  if (findError || !existingTag) {
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
    const { data: updatedTag, error } = await supabase
      .from('Tag')
      .update(updateData)
      .eq('id', tagId)
      .select()
      .single()

    if (error) {
      // Handle unique constraint violation
      if (error.code === '23505' || error.message.includes('duplicate')) {
        throw createError({
          statusCode: 409,
          statusMessage: `Tag "${validation.data.name}" already exists`
        })
      }
      throw error
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
    throw createError({
      statusCode: 500,
      message: error.message
    })
  }
})
