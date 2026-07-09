import { getAuthenticatedUser } from '~/server/utils/auth'
import { getD1 } from '~/server/utils/cloudflare'
import { getSflConfig, createQuoteIdea, findOrCreateTag, tagIdea } from '~/server/utils/sfl'
import { lastRowId } from '~/server/utils/d1Result'
import { extractHashtags } from '~/utils/hashtags'
import { isPersonalUser } from '~/server/utils/personal'

/**
 * Create a highlight: push the marked passage to SFL as a self-contained
 * `quote` idea (with any `#hashtags` in the note promoted to real SFL tags),
 * then store the local anchor row. Fails soft if SFL is unconfigured — the
 * mark still persists locally with `sfl_idea_id = NULL`.
 */
export default defineEventHandler(async (event) => {
  const user = await getAuthenticatedUser(event)

  const articleId = parseInt(getRouterParam(event, 'id') || '')
  if (isNaN(articleId)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid article ID' })
  }

  const body = await readBody(event)
  const quote = typeof body?.quote === 'string' ? body.quote.trim() : ''
  const note = typeof body?.note === 'string' ? body.note.trim() : ''
  const startOffset = Number(body?.startOffset)
  const endOffset = Number(body?.endOffset)
  if (!quote || !Number.isInteger(startOffset) || !Number.isInteger(endOffset) || endOffset <= startOffset) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid highlight' })
  }

  const db = getD1(event)
  const article = await db.prepare(
    `
    SELECT a.id, a.url, a.title
    FROM "Article" a
    JOIN "Feed" f ON f.id = a.feed_id
    WHERE a.id = ? AND f.user_id = ?
    `
  ).bind(articleId, user.id).first<{ id: number; url: string; title: string }>()

  if (!article) {
    throw createError({ statusCode: 404, statusMessage: 'Article not found' })
  }

  // Push to SFL. Fail soft when unconfigured so highlighting works offline.
  // Non-personal accounts skip the mirror entirely — their highlights are
  // local-only (SFL is Petter's personal knowledge pipeline).
  let sflIdeaId: string | null = null
  if (isPersonalUser(event, user)) {
    try {
      const cfg = getSflConfig(event)
      const { ideaId } = await createQuoteIdea(cfg, {
        text: quote,
        note: note || undefined,
        sourceUrl: article.url,
        sourceTitle: article.title,
      })
      sflIdeaId = ideaId

      // Best-effort: promote inline #hashtags to real SFL tags on the quote.
      for (const name of extractHashtags(note)) {
        const tagId = await findOrCreateTag(cfg, name)
        if (tagId) await tagIdea(cfg, ideaId, tagId)
      }
    } catch (err: any) {
      // 503 = SFL not configured: keep the local highlight. Any other SFL error
      // (network/timeout/malformed) is a real failure the user should see.
      if (err?.statusCode !== 503) throw err
    }
  }

  const now = new Date().toISOString()
  const insert = await db.prepare(
    `
    INSERT INTO "Highlight"
      (user_id, article_id, sfl_idea_id, quote, note, start_offset, end_offset, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `
  ).bind(user.id, articleId, sflIdeaId, quote, note || null, startOffset, endOffset, now).run()

  return {
    success: true,
    highlight: {
      id: lastRowId(insert),
      articleId,
      sflIdeaId,
      quote,
      note: note || null,
      startOffset,
      endOffset,
      createdAt: now,
    },
  }
})
