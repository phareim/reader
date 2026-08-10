/**
 * PATCH /api/feeds/[id]
 * Update feed settings. Currently: halfLifeHours — the deck half-life
 * (null resets to the default pace; see utils/decay.ts).
 */

import { getAuthenticatedUser } from '~/server/utils/auth'
import { getD1 } from '~/server/utils/cloudflare'
import { DECAY } from '~/utils/decay'
import { z } from 'zod'

const updateFeedSchema = z.object({
  // 1–8760h, the ∞ sentinel, or null (reset to default).
  halfLifeHours: z.union([
    z.literal(DECAY.FOREVER_HOURS),
    z.number().min(1).max(8760)
  ]).nullable()
})

export default defineEventHandler(async (event) => {
  const user = await getAuthenticatedUser(event)

  const feedId = parseInt(event.context.params?.id || '')
  if (isNaN(feedId)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid feed ID'
    })
  }

  const body = await readBody(event)
  const validation = updateFeedSchema.safeParse(body)

  if (!validation.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid request body',
      data: validation.error.issues
    })
  }

  const { halfLifeHours } = validation.data

  try {
    const db = getD1(event)

    const feed = await db.prepare(
      'SELECT id FROM "Feed" WHERE id = ? AND user_id = ?'
    ).bind(feedId, user.id).first()

    if (!feed) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Feed not found'
      })
    }

    await db.prepare(
      'UPDATE "Feed" SET half_life_hours = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
    ).bind(halfLifeHours, feedId).run()

    return {
      success: true,
      halfLifeHours
    }
  } catch (error: any) {
    if (error.statusCode) {
      throw error
    }

    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to update feed',
      message: error.message
    })
  }
})
