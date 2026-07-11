/**
 * POST /api/ingest
 *
 * Generic ingestion seam for the "Found" feed — a push-only bucket for
 * bookmarks/saves collected from social sources. A Sleeper-side collector
 * (X bookmarks first; Mastodon/Reddit/… later) normalizes each item into
 * the shape below and POSTs it here with an MCP token.
 *
 * The Reader stays source-agnostic: every source reuses this one endpoint and
 * differs only by `source` + `externalId`. Items land UNREAD and are neither
 * auto-saved nor marked read, so they flow into the deck like any article.
 * Idempotent via guid = `${source}:${externalId}` + UNIQUE(feed_id, guid).
 *
 * `replace: true` rebuilds an existing card in place instead of skipping it:
 * the row's metadata and R2 body are overwritten and the card returns to
 * unread (rebuilt content deserves another look). The ai-digest collector
 * uses this to regenerate a day's digest under the same guid.
 */

import { getAuthenticatedUser } from '~/server/utils/auth'
import { getD1 } from '~/server/utils/cloudflare'
import { z } from 'zod'
import { insertArticleWithContent } from '~/server/utils/article-store'
import { storeArticleContent } from '~/server/utils/article-content'
import { resolveFoundFeed } from '~/server/utils/foundFeed'

const ingestSchema = z.object({
  source: z.string().min(1).max(40),
  externalId: z.string().min(1).max(200),
  url: z.string().url(),
  title: z.string().min(1).max(500),
  author: z.string().max(200).optional(),
  content: z.string().optional(),
  summary: z.string().max(2000).optional(),
  imageUrl: z.string().url().optional(),
  publishedAt: z.string().optional(),
  replace: z.boolean().optional()
})

export default defineEventHandler(async (event) => {
  const user = await getAuthenticatedUser(event)

  const body = await readBody(event)
  const validation = ingestSchema.safeParse(body)
  if (!validation.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid request body',
      data: validation.error.issues
    })
  }

  const { source, externalId, url, title, author, content, summary, imageUrl, publishedAt, replace } =
    validation.data

  try {
    const db = getD1(event)

    // Resolve (or lazily create) this user's single Found feed.
    const feedId = await resolveFoundFeed(event, user.id)

    const guid = `${source}:${externalId}`
    const insert = await insertArticleWithContent(event, feedId, {
      guid,
      title,
      url,
      author,
      content,
      summary,
      imageUrl,
      publishedAt: publishedAt || null,
      source
    })

    if (!insert.inserted) {
      const existing = await db.prepare(
        `SELECT id FROM "Article" WHERE feed_id = ? AND guid = ?`
      ).bind(feedId, guid).first<{ id: number }>()

      if (replace && existing?.id) {
        const contentKey = content
          ? await storeArticleContent(event, existing.id, content)
          : null
        await db.prepare(
          `
          UPDATE "Article"
          SET title = ?, url = ?, author = ?, summary = ?, image_url = ?,
              published_at = COALESCE(?, published_at),
              content_key = COALESCE(?, content_key),
              is_read = 0, read_at = NULL, read_progress = 0
          WHERE id = ?
          `
        ).bind(
          title, url, author || null, summary || null, imageUrl || null,
          publishedAt || null, contentKey, existing.id
        ).run()
        return {
          success: true,
          ingested: false,
          existing: true,
          replaced: true,
          article: { id: existing.id, url, feedId }
        }
      }

      return {
        success: true,
        ingested: false,
        existing: true,
        article: { id: existing?.id ?? null, url, feedId }
      }
    }

    return {
      success: true,
      ingested: true,
      existing: false,
      article: { id: insert.id, url, feedId }
    }
  } catch (error: any) {
    if (error.statusCode) throw error
    console.error('Error ingesting Found item:', error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to ingest item',
      message: error.message
    })
  }
})
