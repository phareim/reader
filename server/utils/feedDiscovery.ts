interface DiscoveredFeed {
  url: string
  title: string
  type: 'rss' | 'atom'
}

/**
 * Discovers RSS/Atom feeds from a given URL
 * 1. Fetches the page HTML
 * 2. Parses <link> tags for feed URLs
 * 3. Falls back to common feed URL patterns
 */
export async function discoverFeeds(url: string): Promise<DiscoveredFeed[]> {
  const feeds: DiscoveredFeed[] = []

  try {
    // Normalize URL
    const normalizedUrl = url.startsWith('http') ? url : `https://${url}`
    const parsedUrl = new URL(normalizedUrl)

    // Fetch the page HTML
    const timeout = Number(process.env.FETCH_TIMEOUT) || 30000
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeout)

    const response = await fetch(normalizedUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; RSS Reader/1.0)',
        'Accept': 'text/html,application/xhtml+xml'
      }
    })
    clearTimeout(timeoutId)

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

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
      const hrefMatch = match.match(/href=["']([^"']+)["']/)
      if (!hrefMatch) continue

      let feedUrl = hrefMatch[1]

      // Make URL absolute if relative
      if (!feedUrl.startsWith('http')) {
        if (feedUrl.startsWith('//')) {
          feedUrl = parsedUrl.protocol + feedUrl
        } else if (feedUrl.startsWith('/')) {
          feedUrl = `${parsedUrl.protocol}//${parsedUrl.host}${feedUrl}`
        } else {
          feedUrl = `${parsedUrl.protocol}//${parsedUrl.host}/${feedUrl}`
        }
      }

      // Extract title
      const titleMatch = match.match(/title=["']([^"']+)["']/)
      const title = titleMatch ? titleMatch[1] : (isRss ? 'RSS Feed' : 'Atom Feed')

      feeds.push({
        url: feedUrl,
        title,
        type: isRss ? 'rss' : 'atom'
      })
    }

    // If no feeds found in HTML, try common patterns
    if (feeds.length === 0) {
      const baseUrl = `${parsedUrl.protocol}//${parsedUrl.host}`
      const commonPatterns = [
        '/feed/',
        '/rss/',
        '/atom/',
        '/feed.xml',
        '/rss.xml',
        '/atom.xml',
        '/feeds/posts/default', // Blogger
        '/blog/feed/',
        '/news/feed/'
      ]

      for (const pattern of commonPatterns) {
        const testUrl = baseUrl + pattern
        try {
          const testResponse = await fetch(testUrl, {
            method: 'HEAD',
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; RSS Reader/1.0)' },
            signal: AbortSignal.timeout(5000)
          })

          if (testResponse.ok) {
            const contentType = testResponse.headers.get('content-type') || ''
            if (contentType.includes('xml') || contentType.includes('rss') || contentType.includes('atom')) {
              feeds.push({
                url: testUrl,
                title: `Feed (${pattern})`,
                type: pattern.includes('atom') ? 'atom' : 'rss'
              })
            }
          }
        } catch {
          // Ignore errors for pattern checking
        }
      }
    }

    return feeds
  } catch (error: any) {
    throw new Error(`Failed to discover feeds: ${error.message}`)
  }
}
