import prisma from '~/server/utils/db'
import { parseFeed } from '~/server/utils/feedParser'
import { getServerSession } from '#auth'

export default defineEventHandler(async (event) => {
  // Get authenticated user
  const session = await getServerSession(event)
  if (!session || !session.user?.email) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized'
    })
  }

  // Get user from database
  const user = await prisma.user.findUnique({
    where: { email: session.user.email }
  })

  if (!user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'User not found'
    })
  }

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
    const existingFeed = await prisma.feed.findUnique({
      where: {
        userId_url: {
          userId: user.id,
          url
        }
      }
    })

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
    const feed = await prisma.feed.create({
      data: {
        userId: user.id,
        url,
        title: parsedFeed.title,
        description: parsedFeed.description,
        siteUrl: parsedFeed.siteUrl,
        faviconUrl: parsedFeed.faviconUrl,
        lastFetchedAt: new Date()
      }
    })

    // Add articles (limit to MAX_ARTICLES_PER_FEED)
    const maxArticles = Number(process.env.MAX_ARTICLES_PER_FEED) || 500
    const articlesToAdd = parsedFeed.items.slice(0, maxArticles)

    // Insert articles one by one to handle duplicates (SQLite doesn't support skipDuplicates in createMany)
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
            imageUrl: item.imageUrl,
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
      feed: {
        id: feed.id,
        title: feed.title,
        url: feed.url,
        siteUrl: feed.siteUrl,
        faviconUrl: feed.faviconUrl
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
