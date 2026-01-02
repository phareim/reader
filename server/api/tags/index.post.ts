/**
 * POST /api/tags
 * Create a new tag for the authenticated user
 */

import { getAuthenticatedUser } from '~/server/utils/auth'
import { getSupabaseClient } from '~/server/utils/supabase'
import { z } from 'zod'

const createTagSchema = z.object({
  name: z.string().min(1).max(50).trim(),
  color: z.string().optional()
})

export default defineEventHandler(async (event) => {
  const user = await getAuthenticatedUser(event)
  const supabase = getSupabaseClient(event)

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
    const { data: tag, error } = await supabase
      .from('Tag')
      .insert({
        user_id: user.id,
        name,
        color
      })
      .select()
      .single()

    if (error) {
      // Handle unique constraint violation
      if (error.code === '23505' || error.message.includes('duplicate')) {
        throw createError({
          statusCode: 409,
          statusMessage: `Tag "${name}" already exists`
        })
      }
      throw error
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
    throw createError({
      statusCode: 500,
      message: error.message
    })
  }
})
