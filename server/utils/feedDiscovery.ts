import { decodeEntities } from '~/server/utils/htmlEntities'

interface DiscoveredFeed {
  url: string
  title: string
  type: 'rss' | 'atom'
}

const FEED_CONTENT_TYPE = /(application|text)\/(rss|atom|xml)|xml/i

/**
 * Probe a candidate feed URL: HEAD first (cheap), falling back to GET when the
 * server rejects HEAD (405/403/501 are common). Returns true when the response
 * looks like a feed by content type.
 */
async function probeFeedUrl(url: string): Promise<boolean> {
  const headers = { 'User-Agent': 'Mozilla/5.0 (compatible; RSS Reader/1.0)' }
  for (const method of ['HEAD', 'GET'] as const) {
    try {
      const response = await fetch(url, { method, headers, signal: AbortSignal.timeout(5000) })
      if (method === 'GET') {
        // We only need the headers — don't download the body
        await response.body?.cancel()
      }
      if (!response.ok) {
        if (method === 'HEAD') continue // some servers reject HEAD; retry as GET
        return false
      }
      return FEED_CONTENT_TYPE.test(response.headers.get('content-type') || '')
    } catch {
      if (method === 'GET') return false
    }
  }
  return false
}

/**
 * Discovers RSS/Atom feeds from a given URL
 * 1. Fetches the page HTML
 * 2. Parses <link rel="alternate"> tags for feed URLs
 * 3. Falls back to probing common feed URL patterns
 */
export async function discoverFeeds(url: string): Promise<DiscoveredFeed[]> {
  const feeds: DiscoveredFeed[] = []
  const seen = new Set<string>()

  try {
    // Normalize URL
    const normalizedUrl = url.startsWith('http') ? url : `https://${url}`

    // Fetch the page HTML
    const timeout = Number(process.env.FETCH_TIMEOUT) || 30000
    const response = await fetch(normalizedUrl, {
      signal: AbortSignal.timeout(timeout),
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; RSS Reader/1.0)',
        'Accept': 'text/html,application/xhtml+xml'
      }
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    // Resolve relative hrefs against where we actually landed (redirects)
    const pageUrl = response.url || normalizedUrl
    const html = await response.text()

    // Parse HTML for feed links
    const linkRegex = /<link[^>]+rel=["']alternate["'][^>]*>/gi
    const matches = html.match(linkRegex) || []

    for (const match of matches) {
      // Check if it's an RSS or Atom feed
      const isRss = /type=["']application\/rss\+xml["']/i.test(match)
      const isAtom = /type=["']application\/atom\+xml["']/i.test(match)

      if (!isRss && !isAtom) continue

      // Extract href
      const hrefMatch = match.match(/href=["']([^"']+)["']/i)
      if (!hrefMatch) continue

      let feedUrl: string
      try {
        feedUrl = new URL(decodeEntities(hrefMatch[1]), pageUrl).toString()
      } catch {
        continue
      }

      if (seen.has(feedUrl)) continue
      seen.add(feedUrl)

      // Extract title
      const titleMatch = match.match(/title=["']([^"']+)["']/i)
      const title = titleMatch ? decodeEntities(titleMatch[1]) : (isRss ? 'RSS Feed' : 'Atom Feed')

      feeds.push({
        url: feedUrl,
        title,
        type: isRss ? 'rss' : 'atom'
      })
    }

    // If no feeds found in HTML, try common patterns
    if (feeds.length === 0) {
      const base = new URL(pageUrl)
      const baseUrl = `${base.protocol}//${base.host}`
      const commonPatterns = [
        '/feed/',
        '/rss/',
        '/atom/',
        '/feed.xml',
        '/rss.xml',
        '/atom.xml',
        '/index.xml', // Hugo
        '/feeds/posts/default', // Blogger
        '/blog/feed/',
        '/news/feed/'
      ]

      // The patterns are all guesses at the same main feed (and often
      // redirect to each other), so the first hit is enough — pushing every
      // working alias would present the user with a list of duplicates.
      for (const pattern of commonPatterns) {
        const testUrl = baseUrl + pattern
        if (await probeFeedUrl(testUrl)) {
          feeds.push({
            url: testUrl,
            title: `Feed (${pattern})`,
            type: pattern.includes('atom') ? 'atom' : 'rss'
          })
          break
        }
      }
    }

    return feeds
  } catch (error: any) {
    throw new Error(`Failed to discover feeds: ${error.message}`)
  }
}
