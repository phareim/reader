import { getServerSession } from '#auth'
import prisma from '~/server/utils/db'
import { parseFeed } from '~/server/utils/feedParser'

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

  const id = parseInt(getRouterParam(event, 'id') || '')

  if (isNaN(id)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid feed ID'
    })
  }

  try {
    const feed = await prisma.feed.findFirst({
      where: {
        id,
        userId: user.id
      }
    })

    if (!feed) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Feed not found'
      })
    }

    const parsedFeed = await parseFeed(feed.url)

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

    const maxArticles = Number(process.env.MAX_ARTICLES_PER_FEED) || 500
    const articlesToAdd = parsedFeed.items.slice(0, maxArticles)

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
    await prisma.$transaction(async (tx) => {
      const current = await tx.feed.findFirst({
        where: {
          id,
          userId: user.id
        },
        select: { errorCount: true }
      })

      if (!current) {
        return
      }

      const nextErrorCount = current.errorCount + 1

      await tx.feed.updateMany({
        where: {
          id,
          userId: user.id
        },
        data: {
          lastError: error.message,
          errorCount: nextErrorCount
        }
      })

      if (nextErrorCount >= 10) {
        await tx.feed.updateMany({
          where: {
            id,
            userId: user.id
          },
          data: { isActive: false }
        })
      }
    }).catch(() => {})

    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to refresh feed',
      message: error.message
    })
  }
})
