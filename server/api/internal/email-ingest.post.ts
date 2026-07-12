import { z } from 'zod'
import { getD1 } from '~/server/utils/cloudflare'
import { resolveFoundFeed } from '~/server/utils/foundFeed'
import { insertArticleWithContent } from '~/server/utils/article-store'
import { stripForwardPrefixes, firstHttpLink, emailGuid } from '~/server/utils/emailIngest'
import { looksLikePlainText, paragraphize } from '~/utils/paragraphize'

/**
 * POST /api/internal/email-ingest — the Reader side of the
 * reader@phareim.no forward-to-save flow (docs/email-ingest.md). Called by
 * the standalone `reader-email` Worker (email-worker/) with a dedicated
 * Bearer key after it has verified sender authentication.
 *
 * The sender's address IS the account lookup: mail forwarded from a
 * registered User.email lands as an unread card in that user's Found feed
 * (source='email', guid from the Message-ID so double-forwards are no-ops).
 * Unknown sender → 403 (the email Worker turns that into an SMTP bounce);
 * over the daily cap → 429 (likewise — a runaway auto-forward rule, not a
 * human, is the realistic offender).
 */
const DAILY_CAP = 20

const emailIngestSchema = z.object({
  senderEmail: z.string().email(),
  messageId: z.string().min(1).max(1000),
  subject: z.string().max(1500).optional(),
  author: z.string().max(200).optional(),
  html: z.string().optional(),
  text: z.string().optional(),
  receivedAt: z.string().optional()
})

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event)
  const auth = getHeader(event, 'authorization') || ''
  if (!config.emailIngestKey || auth !== `Bearer ${config.emailIngestKey}`) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const body = await readBody(event)
  const validation = emailIngestSchema.safeParse(body)
  if (!validation.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid request body',
      data: validation.error.issues
    })
  }
  const { senderEmail, messageId, subject, author, html, text, receivedAt } = validation.data

  try {
    const db = getD1(event)

    const user = await db.prepare(
      'SELECT id FROM "User" WHERE email = ? COLLATE NOCASE'
    ).bind(senderEmail.toLowerCase()).first<{ id: string }>()
    if (!user) {
      throw createError({ statusCode: 403, statusMessage: 'Sender is not a registered account' })
    }

    const feedId = await resolveFoundFeed(event, user.id)

    const recent = await db.prepare(
      `
      SELECT COUNT(*) AS n
      FROM "Article"
      WHERE feed_id = ? AND source = 'email'
        AND created_at > datetime('now', '-1 day')
      `
    ).bind(feedId).first<{ n: number }>()
    if (Number(recent?.n ?? 0) >= DAILY_CAP) {
      throw createError({ statusCode: 429, statusMessage: 'Daily email limit reached' })
    }

    // HTML part preferred; a text-only mail gets the same paragraphizer
    // treatment legacy plain-text bodies do. Display-time DOMPurify in the
    // reader is the sanitization boundary, as for every article body.
    const content = html?.trim()
      ? html
      : text?.trim()
        ? (looksLikePlainText(text) ? paragraphize(text) : text)
        : undefined

    const guid = emailGuid(messageId)
    const insert = await insertArticleWithContent(event, feedId, {
      guid,
      title: stripForwardPrefixes(subject),
      // No canonical URL exists for an email; the first link in the body
      // (usually "view in browser") is the most useful stand-in.
      url: firstHttpLink(html, text) || 'https://reader.phareim.no/',
      author,
      content,
      summary: text ? text.replace(/\s+/g, ' ').trim().slice(0, 280) : undefined,
      publishedAt: receivedAt || new Date().toISOString(),
      source: 'email'
    })

    let articleId = insert.id
    if (!insert.inserted) {
      const existing = await db.prepare(
        'SELECT id FROM "Article" WHERE feed_id = ? AND guid = ?'
      ).bind(feedId, guid).first<{ id: number }>()
      articleId = existing?.id ?? null
    }

    return {
      success: true,
      ingested: insert.inserted,
      existing: !insert.inserted,
      article: { id: articleId, feedId }
    }
  } catch (error: any) {
    if (error.statusCode) throw error
    console.error('Error ingesting email:', error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to ingest email',
      message: error.message
    })
  }
})
