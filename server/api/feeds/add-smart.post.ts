/**
 * POST /api/feeds/add-smart
 * Smart endpoint that detects URL type and handles accordingly:
 * 1. Direct RSS/Atom feed -> Add feed
 * 2. Website with discoverable feeds -> Return feed options
 * 3. Article page -> Return article metadata for manual addition
 * 4. Unknown -> Return suggestions
 */

import { getAuthenticatedUser } from '~/server/utils/auth'
import { getSupabaseClient } from '~/server/utils/supabase'
import { parseFeed } from '~/server/utils/feedParser'
import { discoverFeeds } from '~/server/utils/feedDiscovery'
import { extractArticleMetadata } from '~/server/utils/articleExtractor'

export default defineEventHandler(async (event) => {
  const user = await getAuthenticatedUser(event)
  const supabase = getSupabaseClient(event)

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

      // Check if user already has this feed
      const { data: existingFeed } = await supabase
        .from('Feed')
        .select('id, title, url')
        .eq('user_id', user.id)
        .eq('url', normalizedUrl)
        .single()

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

      // Add feed to database
      const { data: feed, error: feedError } = await supabase
        .from('Feed')
        .insert({
          user_id: user.id,
          url: normalizedUrl,
          title: parsedFeed.title,
          description: parsedFeed.description,
          site_url: parsedFeed.siteUrl,
          favicon_url: parsedFeed.faviconUrl,
          last_fetched_at: new Date().toISOString()
        })
        .select()
        .single()

      if (feedError) throw feedError

      // Add articles (limit to MAX_ARTICLES_PER_FEED)
      const maxArticles = Number(process.env.MAX_ARTICLES_PER_FEED) || 50
      const articlesToAdd = parsedFeed.items.slice(0, maxArticles)

      const articlesData = articlesToAdd.map(item => ({
        feed_id: feed.id,
        guid: item.guid,
        title: item.title,
        url: item.url,
        author: item.author,
        content: item.content,
        summary: item.summary,
        image_url: item.imageUrl,
        published_at: item.publishedAt?.toISOString()
      }))

      const { data: insertedArticles } = await supabase
        .from('Article')
        .insert(articlesData)
        .select('id')

      const articlesAdded = insertedArticles?.length || 0

      return {
        type: 'feed_added',
        message: `Feed added successfully with ${articlesAdded} articles`,
        feed: {
          id: feed.id,
          title: feed.title,
          url: feed.url,
          siteUrl: feed.site_url,
          faviconUrl: feed.favicon_url
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

        // Check for existing feed
        const { data: existingFeed } = await supabase
          .from('Feed')
          .select('id, title, url')
          .eq('user_id', user.id)
          .eq('url', normalizedUrl)
          .single()

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

        // Add feed
        const { data: feed, error: feedError } = await supabase
          .from('Feed')
          .insert({
            user_id: user.id,
            url: normalizedUrl,
            title: parsedFeed.title,
            description: parsedFeed.description,
            site_url: parsedFeed.siteUrl,
            favicon_url: parsedFeed.faviconUrl,
            last_fetched_at: new Date().toISOString()
          })
          .select()
          .single()

        if (feedError) throw feedError

        // Add articles
        const maxArticles = Number(process.env.MAX_ARTICLES_PER_FEED) || 500
        const articlesToAdd = parsedFeed.items.slice(0, maxArticles)

        const articlesData = articlesToAdd.map(item => ({
          feed_id: feed.id,
          guid: item.guid,
          title: item.title,
          url: item.url,
          author: item.author,
          content: item.content,
          summary: item.summary,
          image_url: item.imageUrl,
          published_at: item.publishedAt?.toISOString()
        }))

        const { data: insertedArticles } = await supabase
          .from('Article')
          .insert(articlesData)
          .select('id')

        const articlesAdded = insertedArticles?.length || 0

        return {
          type: 'feed_added',
          message: `Feed added successfully with ${articlesAdded} articles`,
          feed: {
            id: feed.id,
            title: feed.title,
            url: feed.url,
            siteUrl: feed.site_url,
            faviconUrl: feed.favicon_url
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
