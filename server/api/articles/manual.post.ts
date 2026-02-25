/**
 * POST /api/articles/manual
 * Add a manual article (not from RSS feed) and save it
 * This allows Claude to add articles it finds interesting
 */

import { getAuthenticatedUser } from '~/server/utils/auth'
import { getD1 } from '~/server/utils/cloudflare'
import { z } from 'zod'
import { insertArticleWithContent } from '~/server/utils/article-store'

const manualArticleSchema = z.object({
  title: z.string().min(1).max(500),
  url: z.string().url(),
  content: z.string().optional(),
  summary: z.string().optional(),
  author: z.string().optional(),
  tags: z.array(z.string().min(1).max(50)).optional()
})

export default defineEventHandler(async (event) => {
  const user = await getAuthenticatedUser(event)

  const body = await readBody(event)
  const validation = manualArticleSchema.safeParse(body)

  if (!validation.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid request body',
      data: validation.error.issues
    })
  }

  const { title, url, content, summary, author, tags } = validation.data

  try {
    const db = getD1(event)
    const manualFeedUrl = `manual://${user.id}`

    let feed = await db.prepare(
      'SELECT id FROM "Feed" WHERE user_id = ? AND url = ?'
    ).bind(user.id, manualFeedUrl).first()

    if (!feed) {
      const insertFeed = await db.prepare(
        `
        INSERT INTO "Feed" (
          user_id,
          url,
          title,
          description,
          site_url,
          favicon_url,
          last_fetched_at,
          is_active
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `
      ).bind(
        user.id,
        manualFeedUrl,
        'Manual Additions',
        'Manually added articles',
        null,
        null,
        new Date().toISOString(),
        0
      ).run()

      feed = { id: insertFeed.lastRowId }
    }

    if (!feed?.id) {
      throw new Error('Failed to create manual feed')
    }

    const articleInsert = await insertArticleWithContent(event, Number(feed.id), {
      guid: url,
      title,
      url,
      author,
      content,
      summary
    })

    let articleId = articleInsert.id
    if (!articleId) {
      const existing = await db.prepare(
        'SELECT id FROM "Article" WHERE feed_id = ? AND guid = ?'
      ).bind(feed.id, url).first()
      articleId = existing?.id || null
    }

    if (!articleId) {
      throw new Error('Failed to create article')
    }

    await db.prepare(
      `
      INSERT OR IGNORE INTO "SavedArticle" (user_id, article_id, saved_at)
      VALUES (?, ?, ?)
      `
    ).bind(user.id, articleId, new Date().toISOString()).run()

    const savedArticle = await db.prepare(
      `
      SELECT id, saved_at
      FROM "SavedArticle"
      WHERE user_id = ? AND article_id = ?
      `
    ).bind(user.id, articleId).first()

    if (!savedArticle) {
      throw new Error('Failed to save article')
    }

    for (const tagName of tags || []) {
      await db.prepare(
        `
        INSERT OR IGNORE INTO "Tag" (user_id, name)
        VALUES (?, ?)
        `
      ).bind(user.id, tagName).run()

      const tag = await db.prepare(
        'SELECT id FROM "Tag" WHERE user_id = ? AND name = ?'
      ).bind(user.id, tagName).first()

      if (tag) {
        await db.prepare(
          `
          INSERT OR IGNORE INTO "SavedArticleTag" (saved_article_id, tag_id, tagged_at)
          VALUES (?, ?, ?)
          `
        ).bind(savedArticle.id, tag.id, new Date().toISOString()).run()
      }
    }

    return {
      success: true,
      article: {
        id: articleId,
        title,
        url,
        savedAt: savedArticle.saved_at
      },
      tags: tags || []
    }
  } catch (error: any) {
    console.error('Error adding manual article:', error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to add manual article',
      message: error.message
    })
  }
})
