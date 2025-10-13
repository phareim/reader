import prisma from '~/server/utils/db'
import { parseFeed } from '~/server/utils/feedParser'

export default defineEventHandler(async (event) => {
  const id = parseInt(getRouterParam(event, 'id') || '')

  if (isNaN(id)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid feed ID'
    })
  }

  try {
    const feed = await prisma.feed.findUnique({
      where: { id }
    })

    if (!feed) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Feed not found'
      })
    }

    // Parse the feed
    const parsedFeed = await parseFeed(feed.url)

    // Update feed metadata
    await prisma.feed.update({
      where: { id },
      data: {
        title: parsedFeed.title,
        description: parsedFeed.description,
        siteUrl: parsedFeed.siteUrl,
        faviconUrl: parsedFeed.faviconUrl,
        lastFetchedAt: new Date(),
        lastError: null,
        errorCount: 0
      }
    })

    // Add new articles
    const maxArticles = Number(process.env.MAX_ARTICLES_PER_FEED) || 500
    const articlesToAdd = parsedFeed.items.slice(0, maxArticles)

    // Insert articles one by one to handle duplicates (SQLite doesn't support skipDuplicates in createMany)
    let newArticles = 0
    for (const item of articlesToAdd) {
      try {
        await prisma.article.create({
          data: {
            feedId: id,
            guid: item.guid,
            title: item.title,
            url: item.url,
            author: item.author,
            content: item.content,
            summary: item.summary,
            publishedAt: item.publishedAt
          }
        })
        newArticles++
      } catch (error: any) {
        // Ignore duplicate key errors (P2002)
        if (error.code !== 'P2002') {
          throw error
        }
      }
    }

    return {
      success: true,
      newArticles
    }
  } catch (error: any) {
    // Update feed with error
    await prisma.feed.update({
      where: { id },
      data: {
        lastError: error.message,
        errorCount: { increment: 1 },
        isActive: { set: false } // Disable feed if errorCount >= 10
      }
    }).catch(() => {}) // Ignore error if feed was deleted

    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to refresh feed',
      message: error.message
    })
  }
})
