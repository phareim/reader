import { getAuthenticatedUser } from '~/server/utils/auth'
import { getD1 } from '~/server/utils/cloudflare'
import { parseFeed } from '~/server/utils/feedParser'
import { insertArticleWithContent } from '~/server/utils/article-store'

export default defineEventHandler(async (event) => {
  const user = await getAuthenticatedUser(event)
  const db = getD1(event)

  const id = parseInt(getRouterParam(event, 'id') || '')

  if (isNaN(id)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid feed ID'
    })
  }

  try {
    // Verify feed exists and belongs to user
    const feed = await db.prepare(
      'SELECT url FROM "Feed" WHERE id = ? AND user_id = ?'
    ).bind(id, user.id).first()

    if (!feed) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Feed not found'
      })
    }

    const parsedFeed = await parseFeed(feed.url)

    await db.prepare(
      `
      UPDATE "Feed"
      SET title = ?,
          description = ?,
          site_url = ?,
          favicon_url = ?,
          last_fetched_at = ?,
          last_error = NULL,
          error_count = 0
      WHERE id = ?
      `
    ).bind(
      parsedFeed.title,
      parsedFeed.description || null,
      parsedFeed.siteUrl || null,
      parsedFeed.faviconUrl || null,
      new Date().toISOString(),
      id
    ).run()

    const maxArticles = Number(process.env.MAX_ARTICLES_PER_FEED) || 500
    const articlesToAdd = parsedFeed.items.slice(0, maxArticles)

    let newArticles = 0
    for (const item of articlesToAdd) {
      const result = await insertArticleWithContent(event, id, {
        guid: item.guid,
        title: item.title,
        url: item.url,
        author: item.author,
        content: item.content,
        summary: item.summary,
        imageUrl: item.imageUrl,
        publishedAt: item.publishedAt
      })
      if (result.inserted) {
        newArticles += 1
      }
    }

    return {
      success: true,
      newArticles
    }
  } catch (error: any) {
    // On error, increment error count and deactivate after 10 errors
    try {
      const current = await db.prepare(
        'SELECT error_count FROM "Feed" WHERE id = ? AND user_id = ?'
      ).bind(id, user.id).first()

      if (current) {
        const nextErrorCount = (current.error_count || 0) + 1
        await db.prepare(
          `
          UPDATE "Feed"
          SET last_error = ?,
              error_count = ?,
              is_active = ?
          WHERE id = ? AND user_id = ?
          `
        ).bind(
          error.message,
          nextErrorCount,
          nextErrorCount >= 10 ? 0 : 1,
          id,
          user.id
        ).run()
      }
    } catch (updateError) {
      // Ignore errors during error tracking update
    }

    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to refresh feed',
      message: error.message
    })
  }
})
