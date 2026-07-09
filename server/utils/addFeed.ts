import type { H3Event } from 'h3'
import { getD1 } from '~/server/utils/cloudflare'
import { parseFeed } from '~/server/utils/feedParser'
import { insertArticleWithContent } from '~/server/utils/article-store'
import { lastRowId } from '~/server/utils/d1Result'

export interface AddedFeed {
  id: number
  title: string
  url: string
  siteUrl?: string | null
  faviconUrl?: string | null
}

export interface AddFeedResult {
  existing: boolean
  feed: AddedFeed
  articlesAdded: number
}

/**
 * Subscribe a user to a feed URL: parse it, insert the Feed row, and store
 * its initial articles. Returns `existing: true` (and adds nothing) when the
 * user already has the URL. Throws if the URL does not parse as a feed.
 * Shared by POST /api/feeds and POST /api/feeds/add-smart.
 */
export async function addFeedForUser(event: H3Event, userId: number, url: string): Promise<AddFeedResult> {
  const db = getD1(event)

  const existingFeed = await db.prepare(
    'SELECT id, title, url FROM "Feed" WHERE user_id = ? AND url = ?'
  ).bind(userId, url).first<{ id: number; title: string; url: string }>()

  if (existingFeed) {
    return {
      existing: true,
      feed: { id: existingFeed.id, title: existingFeed.title, url: existingFeed.url },
      articlesAdded: 0
    }
  }

  const parsedFeed = await parseFeed(url)

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
    userId,
    url,
    parsedFeed.title,
    parsedFeed.description || null,
    parsedFeed.siteUrl || null,
    parsedFeed.faviconUrl || null,
    new Date().toISOString()
  ).run()

  const feedId = lastRowId(insertFeed)
  if (!feedId) {
    throw new Error('Failed to create feed')
  }

  const maxArticles = Number(process.env.MAX_ARTICLES_PER_FEED) || 100
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
    existing: false,
    feed: {
      id: Number(feedId),
      title: parsedFeed.title,
      url,
      siteUrl: parsedFeed.siteUrl,
      faviconUrl: parsedFeed.faviconUrl
    },
    articlesAdded
  }
}
