/**
 * POST /api/feeds/add-smart
 * Smart endpoint that detects URL type and handles accordingly:
 * 1. Direct RSS/Atom feed -> Add feed (`feed_added` / `feed_exists`)
 * 2. Website with exactly one discoverable feed -> Add it (`feed_added` / `feed_exists`)
 * 3. Website with several feeds -> Return options (`feeds_discovered`)
 * 4. Article page -> Return metadata for manual addition (`article_detected`)
 * 5. Unknown -> Return suggestions (`unknown`)
 */

import { getAuthenticatedUser } from '~/server/utils/auth'
import { addFeedForUser } from '~/server/utils/addFeed'
import { discoverFeeds } from '~/server/utils/feedDiscovery'
import { extractArticleMetadata } from '~/server/utils/articleExtractor'

function feedResponse(result: Awaited<ReturnType<typeof addFeedForUser>>) {
  if (result.existing) {
    return {
      type: 'feed_exists' as const,
      message: 'This feed is already in your subscription list',
      feed: result.feed
    }
  }
  return {
    type: 'feed_added' as const,
    message: `Feed added successfully with ${result.articlesAdded} articles`,
    feed: result.feed,
    articlesAdded: result.articlesAdded
  }
}

export default defineEventHandler(async (event) => {
  const user = await getAuthenticatedUser(event)

  const body = await readBody(event)
  const { url } = body

  if (!url || typeof url !== 'string') {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid request',
      message: 'URL is required'
    })
  }

  // Normalize URL — a bare domain ("vg.no") becomes https://vg.no
  const normalizedUrl = url.trim().startsWith('http') ? url.trim() : `https://${url.trim()}`

  try {
    // ====================================
    // STEP 1: Try the URL as a direct feed
    // ====================================
    try {
      return feedResponse(await addFeedForUser(event, user.id, normalizedUrl))
    } catch {
      // Not a direct feed — fall through to discovery
    }

    // ====================================
    // STEP 2: Discover feeds on the page
    // ====================================
    const discoveredFeeds = await discoverFeeds(normalizedUrl)

    if (discoveredFeeds.length === 1) {
      // One feed — no choice to present, just subscribe
      return feedResponse(await addFeedForUser(event, user.id, discoveredFeeds[0].url))
    }

    if (discoveredFeeds.length > 1) {
      return {
        type: 'feeds_discovered' as const,
        message: `Found ${discoveredFeeds.length} feeds`,
        feeds: discoveredFeeds.map(f => ({
          url: f.url,
          title: f.title,
          type: f.type
        }))
      }
    }

    // ====================================
    // STEP 3: No feeds — is it an article?
    // ====================================
    const timeout = Number(process.env.FETCH_TIMEOUT) || 30000
    const response = await fetch(normalizedUrl, {
      signal: AbortSignal.timeout(timeout),
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; RSS Reader/1.0)',
        'Accept': 'text/html,application/xhtml+xml'
      }
    })

    if (response.ok && (response.headers.get('content-type') || '').includes('html')) {
      const html = await response.text()
      const articleMeta = extractArticleMetadata(html, normalizedUrl)

      if (articleMeta.isArticle) {
        return {
          type: 'article_detected' as const,
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

      return {
        type: 'unknown' as const,
        message: 'No feeds found on this page. You can save it as a manual article if you like.',
        suggestion: {
          title: articleMeta.title || 'Untitled',
          url: normalizedUrl
        }
      }
    }

    throw createError({
      statusCode: 404,
      statusMessage: 'No feeds found',
      message: 'Could not find an RSS or Atom feed at this URL'
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
