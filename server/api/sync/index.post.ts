import prisma from '~/server/utils/db'
import { parseFeed } from '~/server/utils/feedParser'

interface SyncResult {
  feedId: number
  feedTitle: string
  success: boolean
  newArticles?: number
  error?: string
}

async function syncFeed(feedId: number, feedUrl: string, feedTitle: string): Promise<SyncResult> {
  try {
    const parsedFeed = await parseFeed(feedUrl)

    // Update feed metadata
    await prisma.feed.update({
      where: { id: feedId },
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
    let articlesAdded = 0
    for (const item of articlesToAdd) {
      try {
        await prisma.article.create({
          data: {
            feedId,
            guid: item.guid,
            title: item.title,
            url: item.url,
            author: item.author,
            content: item.content,
            summary: item.summary,
            publishedAt: item.publishedAt
          }
        })
        articlesAdded++
      } catch (error: any) {
        // Ignore duplicate key errors (P2002)
        if (error.code !== 'P2002') {
          throw error
        }
      }
    }

    return {
      feedId,
      feedTitle,
      success: true,
      newArticles: articlesAdded
    }
  } catch (error: any) {
    // Update feed with error
    const currentFeed = await prisma.feed.findUnique({ where: { id: feedId } })
    const newErrorCount = (currentFeed?.errorCount || 0) + 1

    await prisma.feed.update({
      where: { id: feedId },
      data: {
        lastError: error.message,
        errorCount: newErrorCount,
        isActive: newErrorCount < 10 // Disable after 10 consecutive failures
      }
    }).catch(() => {}) // Ignore if feed was deleted

    return {
      feedId,
      feedTitle,
      success: false,
      error: error.message
    }
  }
}

export default defineEventHandler(async (event) => {
  try {
    // Get all active feeds
    const feeds = await prisma.feed.findMany({
      where: { isActive: true }
    })

    if (feeds.length === 0) {
      return {
        results: [],
        summary: {
          total: 0,
          succeeded: 0,
          failed: 0,
          newArticles: 0
        }
      }
    }

    // Sync feeds with concurrency limit of 5
    const concurrencyLimit = 5
    const results: SyncResult[] = []

    for (let i = 0; i < feeds.length; i += concurrencyLimit) {
      const batch = feeds.slice(i, i + concurrencyLimit)
      const batchResults = await Promise.allSettled(
        batch.map(feed => syncFeed(feed.id, feed.url, feed.title))
      )

      results.push(...batchResults.map((r, idx) =>
        r.status === 'fulfilled'
          ? r.value
          : {
              feedId: batch[idx].id,
              feedTitle: batch[idx].title,
              success: false,
              error: 'Unexpected error during sync'
            }
      ))
    }

    const summary = {
      total: results.length,
      succeeded: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      newArticles: results.reduce((sum, r) => sum + (r.newArticles || 0), 0)
    }

    return {
      results,
      summary
    }
  } catch (error: any) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Sync failed',
      message: error.message
    })
  }
})
