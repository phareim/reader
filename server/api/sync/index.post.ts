import type { Feed } from '@prisma/client'
import { getServerSession } from '#auth'
import prisma from '~/server/utils/db'
import { parseFeed } from '~/server/utils/feedParser'

interface SyncResult {
  feedId: number
  feedTitle: string
  success: boolean
  newArticles?: number
  error?: string
}

async function syncFeed(feed: Pick<Feed, 'id' | 'url' | 'title' | 'userId'>): Promise<SyncResult> {
  try {
    const parsedFeed = await parseFeed(feed.url)

    await prisma.feed.updateMany({
      where: {
        id: feed.id,
        userId: feed.userId
      },
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

    const maxArticles = Number(process.env.MAX_ARTICLES_PER_FEED) || 500
    const articlesToAdd = parsedFeed.items.slice(0, maxArticles)

    let articlesAdded = 0
    for (const item of articlesToAdd) {
      try {
        await prisma.article.create({
          data: {
            feedId: feed.id,
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
      feedId: feed.id,
      feedTitle: feed.title,
      success: true,
      newArticles: articlesAdded
    }
  } catch (error: any) {
    await prisma.$transaction(async (tx) => {
      const current = await tx.feed.findFirst({
        where: {
          id: feed.id,
          userId: feed.userId
        },
        select: { errorCount: true }
      })

      if (!current) {
        return
      }

      const nextErrorCount = current.errorCount + 1

      await tx.feed.updateMany({
        where: {
          id: feed.id,
          userId: feed.userId
        },
        data: {
          lastError: error.message,
          errorCount: nextErrorCount
        }
      })

      if (nextErrorCount >= 10) {
        await tx.feed.updateMany({
          where: {
            id: feed.id,
            userId: feed.userId
          },
          data: { isActive: false }
        })
      }
    }).catch(() => {})

    return {
      feedId: feed.id,
      feedTitle: feed.title,
      success: false,
      error: error.message
    }
  }
}

export default defineEventHandler(async (event) => {
  const session = await getServerSession(event)
  if (!session || !session.user?.email) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized'
    })
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true }
  })

  if (!user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'User not found'
    })
  }

  try {
    const feeds = await prisma.feed.findMany({
      where: {
        userId: user.id,
        isActive: true
      },
      select: {
        id: true,
        url: true,
        title: true,
        userId: true
      }
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

    const concurrencyLimit = 5
    const results: SyncResult[] = []

    for (let i = 0; i < feeds.length; i += concurrencyLimit) {
      const batch = feeds.slice(i, i + concurrencyLimit)
      const batchResults = await Promise.allSettled(
        batch.map(feed => syncFeed(feed))
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
