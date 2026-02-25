/**
 * POST /api/feeds/add-smart
 * Smart endpoint that detects URL type and handles accordingly:
 * 1. Direct RSS/Atom feed -> Add feed
 * 2. Website with discoverable feeds -> Return feed options
 * 3. Article page -> Return article metadata for manual addition
 * 4. Unknown -> Return suggestions
 */

import { getAuthenticatedUser } from '~/server/utils/auth'
import { getD1 } from '~/server/utils/cloudflare'
import { parseFeed } from '~/server/utils/feedParser'
import { discoverFeeds } from '~/server/utils/feedDiscovery'
import { extractArticleMetadata } from '~/server/utils/articleExtractor'
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
      message: 'URL is required'
    })
  }

  // Normalize URL
  const normalizedUrl = url.trim().startsWith('http') ? url.trim() : `https://${url.trim()}`

  try {
    // ====================================
    // STEP 1: Try parsing as direct feed
    // ====================================
    try {
      const parsedFeed = await parseFeed(normalizedUrl)

      const existingFeed = await db.prepare(
        'SELECT id, title, url FROM "Feed" WHERE user_id = ? AND url = ?'
      ).bind(user.id, normalizedUrl).first()

      if (existingFeed) {
        return {
          type: 'feed_exists',
          message: 'This feed is already in your subscription list',
          feed: {
            id: existingFeed.id,
            title: existingFeed.title,
            url: existingFeed.url
          }
        }
      }

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
        normalizedUrl,
        parsedFeed.title,
        parsedFeed.description || null,
        parsedFeed.siteUrl || null,
        parsedFeed.faviconUrl || null,
        new Date().toISOString()
      ).run()

      const feedId = insertFeed.lastRowId
      if (!feedId) {
        throw new Error('Failed to create feed')
      }

      const maxArticles = Number(process.env.MAX_ARTICLES_PER_FEED) || 50
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
        type: 'feed_added',
        message: `Feed added successfully with ${articlesAdded} articles`,
        feed: {
          id: feedId,
          title: parsedFeed.title,
          url: normalizedUrl,
          siteUrl: parsedFeed.siteUrl,
          faviconUrl: parsedFeed.faviconUrl
        },
        articlesAdded
      }
    } catch (feedError: any) {
      // Not a direct feed, continue to step 2
      console.log('Not a direct feed, trying discovery...', feedError.message)
    }

    // ====================================
    // STEP 2: Fetch URL and analyze
    // ====================================
    const timeout = Number(process.env.FETCH_TIMEOUT) || 30000
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeout)

    let response
    try {
      response = await fetch(normalizedUrl, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; RSS Reader/1.0)',
          'Accept': 'text/html,application/xhtml+xml,application/xml,application/rss+xml,application/atom+xml'
        }
      })
      clearTimeout(timeoutId)
    } catch (fetchError: any) {
      clearTimeout(timeoutId)
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to fetch URL',
        message: `Could not fetch URL: ${fetchError.message}`
      })
    }

    if (!response.ok) {
      throw createError({
        statusCode: response.status,
        statusMessage: 'Failed to fetch URL',
        message: `HTTP ${response.status}: ${response.statusText}`
      })
    }

    const contentType = response.headers.get('content-type') || ''

    // Check if response is a feed by content-type
    if (contentType.includes('rss') || contentType.includes('atom') || contentType.includes('xml')) {
      try {
        const parsedFeed = await parseFeed(normalizedUrl)

        const existingFeed = await db.prepare(
          'SELECT id, title, url FROM "Feed" WHERE user_id = ? AND url = ?'
        ).bind(user.id, normalizedUrl).first()

        if (existingFeed) {
          return {
            type: 'feed_exists',
            message: 'This feed is already in your subscription list',
            feed: {
              id: existingFeed.id,
              title: existingFeed.title,
              url: existingFeed.url
            }
          }
        }

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
          normalizedUrl,
          parsedFeed.title,
          parsedFeed.description || null,
          parsedFeed.siteUrl || null,
          parsedFeed.faviconUrl || null,
          new Date().toISOString()
        ).run()

        const feedId = insertFeed.lastRowId
        if (!feedId) {
          throw new Error('Failed to create feed')
        }

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
          type: 'feed_added',
          message: `Feed added successfully with ${articlesAdded} articles`,
          feed: {
            id: feedId,
            title: parsedFeed.title,
            url: normalizedUrl,
            siteUrl: parsedFeed.siteUrl,
            faviconUrl: parsedFeed.faviconUrl
          },
          articlesAdded
        }
      } catch (error) {
        // Failed to parse as feed, continue
        console.log('Failed to parse XML as feed, continuing...', error)
      }
    }

    // ====================================
    // STEP 3: It's HTML - discover or extract
    // ====================================
    if (contentType.includes('html')) {
      const html = await response.text()

      // Try discovering feeds from HTML
      try {
        const discoveredFeeds = await discoverFeeds(normalizedUrl)

        if (discoveredFeeds.length > 0) {
          return {
            type: 'feeds_discovered',
            message: `Found ${discoveredFeeds.length} feed${discoveredFeeds.length > 1 ? 's' : ''}`,
            feeds: discoveredFeeds.map(f => ({
              url: f.url,
              title: f.title,
              type: f.type
            }))
          }
        }
      } catch (error) {
        console.log('Feed discovery failed, trying article extraction...', error)
      }

      // No feeds found - try extracting article metadata
      const articleMeta = extractArticleMetadata(html, normalizedUrl)

      if (articleMeta.isArticle) {
        return {
          type: 'article_detected',
          message: 'This appears to be an article. Would you like to save it?',
          article: {
            title: articleMeta.title,
            url: articleMeta.url,
            description: articleMeta.description,
            author: articleMeta.author,
            content: articleMeta.content,
            publishedAt: articleMeta.publishedAt,
            imageUrl: articleMeta.imageUrl
          }
        }
      }

      // Neither feed nor clear article
      return {
        type: 'unknown',
        message: 'No feeds found on this page. You can save it as a manual article if you like.',
        suggestion: {
          title: articleMeta.title || 'Untitled',
          url: normalizedUrl
        }
      }
    }

    // Unsupported content type
    throw createError({
      statusCode: 400,
      statusMessage: 'Unsupported content type',
      message: `Cannot handle content type: ${contentType}`
    })

  } catch (error: any) {
    // If it's already a createError, rethrow it
    if (error.statusCode) {
      throw error
    }

    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to process URL',
      message: error.message
    })
  }
})
