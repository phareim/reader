import { getAuthenticatedUser } from '~/server/utils/auth'
import { getD1 } from '~/server/utils/cloudflare'
import { getSflConfig, createPageIdea } from '~/server/utils/sfl'

/**
 * Elevate an article into the SFL knowledge pipeline: create a page idea in
 * SFL (which sleeper-articles polls and folds into thoughts/wiki), and mark
 * the article read locally. NOT optimistic — the client keeps the card if
 * this fails.
 */
export default defineEventHandler(async (event) => {
  const user = await getAuthenticatedUser(event)

  const articleId = parseInt(getRouterParam(event, 'id') || '')
  if (isNaN(articleId)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid article ID' })
  }

  const db = getD1(event)
  const article = await db.prepare(
    `
    SELECT a.id, a.title, a.url
    FROM "Article" a
    JOIN "Feed" f ON f.id = a.feed_id
    WHERE a.id = ? AND f.user_id = ?
    `
  ).bind(articleId, user.id).first<{ id: number; title: string; url: string }>()

  if (!article) {
    throw createError({ statusCode: 404, statusMessage: 'Article not found' })
  }

  const { ideaId, existing } = await createPageIdea(getSflConfig(), {
    url: article.url,
    title: article.title,
  })

  // Mirrors read.patch.ts: is_read flag + ISO read_at timestamp.
  await db.prepare(
    `UPDATE "Article" SET is_read = 1, read_at = ? WHERE id = ?`
  ).bind(new Date().toISOString(), articleId).run()

  return { success: true, ideaId, existing }
})
