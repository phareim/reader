import { getAuthenticatedUser } from '~/server/utils/auth'
import { getD1 } from '~/server/utils/cloudflare'
import { parseFeed } from '~/server/utils/feedParser'
import { insertArticleWithContent } from '~/server/utils/article-store'

export default defineEventHandler(async (event) => {
  const user = await getAuthenticatedUser(event)
  const db = getD1(event)

  const body = await readBody(event)
  const { url } = body

  if (!url || typeof url !== 'string') {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid request',
      message: 'Feed URL is required'
    })
  }

  try {
    // Check if user already has this feed
    const existingFeed = await db.prepare(
      'SELECT id FROM "Feed" WHERE user_id = ? AND url = ?'
    ).bind(user.id, url).first()

    if (existingFeed) {
      throw createError({
        statusCode: 409,
        statusMessage: 'Feed already exists',
        message: 'This feed is already in your subscription list'
      })
    }

    // Parse the feed
    const parsedFeed = await parseFeed(url)

    // Create feed in database
    const insertFeed = await db.prepare(
      `
      INSERT INTO "Feed" (
        user_id,
        url,
        title,
        description,
        site_url,
        favicon_url,
        last_fetched_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `
    ).bind(
      user.id,
      url,
      parsedFeed.title,
      parsedFeed.description || null,
      parsedFeed.siteUrl || null,
      parsedFeed.faviconUrl || null,
      new Date().toISOString()
    ).run()

    const feedId = insertFeed.lastRowId

    if (!feedId) {
      throw createError({
        statusCode: 500,
        message: 'Failed to create feed'
      })
    }

    // Add articles (limit to MAX_ARTICLES_PER_FEED)
    const maxArticles = Number(process.env.MAX_ARTICLES_PER_FEED) || 500
    const articlesToAdd = parsedFeed.items.slice(0, maxArticles)

    let articlesAdded = 0
    for (const item of articlesToAdd) {
      const result = await insertArticleWithContent(event, Number(feedId), {
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
        articlesAdded += 1
      }
    }

    return {
      feed: {
        id: feedId,
        title: parsedFeed.title,
        url,
        siteUrl: parsedFeed.siteUrl,
        faviconUrl: parsedFeed.faviconUrl
      },
      articlesAdded
    }
  } catch (error: any) {
    // If it's already a createError, rethrow it
    if (error.statusCode) {
      throw error
    }

    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to add feed',
      message: error.message
    })
  }
})
