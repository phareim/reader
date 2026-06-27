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
 */

import { getAuthenticatedUser } from '~/server/utils/auth'
import { getD1 } from '~/server/utils/cloudflare'
import { z } from 'zod'
import { insertArticleWithContent } from '~/server/utils/article-store'
import { lastRowId } from '~/server/utils/d1Result'

const ingestSchema = z.object({
  source: z.string().min(1).max(40),
  externalId: z.string().min(1).max(200),
  url: z.string().url(),
  title: z.string().min(1).max(500),
  author: z.string().max(200).optional(),
  content: z.string().optional(),
  summary: z.string().max(2000).optional(),
  imageUrl: z.string().url().optional(),
  publishedAt: z.string().optional()
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

  const { source, externalId, url, title, author, content, summary, imageUrl, publishedAt } =
    validation.data

  try {
    const db = getD1(event)

    // Resolve (or lazily create) this user's single Found feed.
    const foundFeedUrl = `found://${user.id}`
    let feed = await db.prepare(
      `SELECT id FROM "Feed" WHERE user_id = ? AND kind = 'found'`
    ).bind(user.id).first<{ id: number }>()

    if (!feed) {
      const insertFeed = await db.prepare(
        `
        INSERT INTO "Feed" (user_id, url, title, description, kind, last_fetched_at, is_active)
        VALUES (?, ?, ?, ?, 'found', ?, 0)
        ON CONFLICT(user_id, url) DO UPDATE SET kind = 'found'
        `
      ).bind(
        user.id,
        foundFeedUrl,
        'Found',
        'Bookmarks and saves collected from across the web',
        new Date().toISOString()
      ).run()

      const newId = lastRowId(insertFeed)
      feed = newId
        ? { id: newId }
        : await db.prepare(`SELECT id FROM "Feed" WHERE user_id = ? AND url = ?`)
            .bind(user.id, foundFeedUrl).first<{ id: number }>()
    }

    if (!feed?.id) {
      throw new Error('Failed to resolve Found feed')
    }

    const guid = `${source}:${externalId}`
    const insert = await insertArticleWithContent(event, Number(feed.id), {
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
      ).bind(feed.id, guid).first<{ id: number }>()
      return {
        success: true,
        ingested: false,
        existing: true,
        article: { id: existing?.id ?? null, url, feedId: Number(feed.id) }
      }
    }

    return {
      success: true,
      ingested: true,
      existing: false,
      article: { id: insert.id, url, feedId: Number(feed.id) }
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
