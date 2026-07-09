import { getAuthenticatedUser } from '~/server/utils/auth'
import { getD1 } from '~/server/utils/cloudflare'
import { getSflConfig, createPageIdea, deleteIdea } from '~/server/utils/sfl'
import { isPersonalUser } from '~/server/utils/personal'

/**
 * Elevate an article into the SFL knowledge pipeline: create a page idea in
 * SFL (which sleeper-articles polls and folds into thoughts/wiki), and mark
 * the article read locally. NOT optimistic — the client keeps the card if
 * this fails.
 */
export default defineEventHandler(async (event) => {
  const user = await getAuthenticatedUser(event)
  if (!isPersonalUser(event, user)) {
    // SFL is Petter's personal knowledge pipeline — other accounts must not
    // write into it. The UI hides the verb; this is the backstop.
    throw createError({ statusCode: 403, statusMessage: 'Elevate is not available on this account' })
  }

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

  const cfg = getSflConfig(event)
  const { ideaId, existing } = await createPageIdea(cfg, {
    url: article.url,
    title: article.title,
  })

  // Mirrors read.patch.ts: is_read flag + ISO read_at timestamp. Also record
  // the idea id, but only when we created it (!existing) — undo reads it back
  // from here instead of trusting a client-supplied id. A pre-existing idea is
  // not ours to delete, so we store NULL for it.
  try {
    await db.prepare(
      `UPDATE "Article" SET is_read = 1, read_at = ?, sfl_idea_id = ? WHERE id = ?`
    ).bind(new Date().toISOString(), existing ? null : ideaId, articleId).run()
  } catch (err) {
    // Compensate: undo the SFL idea we just created, but only when we created
    // it (!existing). The !existing guard prevents deleting a pre-existing idea;
    // SFL's URL-dedupe makes a failed compensation self-healing on retry.
    if (!existing) await deleteIdea(cfg, ideaId).catch(() => {})
    throw err
  }

  return { success: true, ideaId, existing }
})
