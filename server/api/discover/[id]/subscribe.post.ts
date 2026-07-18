import { getAuthenticatedUser } from '~/server/utils/auth'
import { getD1 } from '~/server/utils/cloudflare'
import { addFeedForUser } from '~/server/utils/addFeed'

/**
 * The Add verb on a /discover row: subscribe to the candidate's feed and
 * mark the row 'subscribed' (a terminal status — the crawl never
 * resurrects it). addFeedForUser's `existing: true` still counts as
 * subscribed; a feed that died since the probe bumps `attempts` and 422s.
 */
export default defineEventHandler(async (event) => {
  const user = await getAuthenticatedUser(event)
  const candidateId = parseInt(getRouterParam(event, 'id') || '')
  if (isNaN(candidateId)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid candidate ID' })
  }

  const db = getD1(event)
  const candidate = await db.prepare(
    `
    SELECT id, feed_url
    FROM "DiscoverCandidate"
    WHERE id = ? AND user_id = ? AND status = 'candidate'
    `
  ).bind(candidateId, user.id).first<{ id: number; feed_url: string }>()

  if (!candidate) {
    throw createError({ statusCode: 404, statusMessage: 'Candidate not found' })
  }

  let result
  try {
    result = await addFeedForUser(event, user.id, candidate.feed_url)
  } catch (error: any) {
    await db.prepare(
      'UPDATE "DiscoverCandidate" SET attempts = attempts + 1, last_error = ?, updated_at = ? WHERE id = ?'
    ).bind(String(error?.message || error), new Date().toISOString(), candidateId).run()
    throw createError({ statusCode: 422, statusMessage: 'That feed stopped responding' })
  }

  await db.prepare(
    `UPDATE "DiscoverCandidate" SET status = 'subscribed', updated_at = ? WHERE id = ?`
  ).bind(new Date().toISOString(), candidateId).run()

  return {
    existing: result.existing,
    feed: result.feed,
    articlesAdded: result.articlesAdded,
  }
})
