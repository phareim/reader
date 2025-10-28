import Parser from 'rss-parser'
import DOMPurify from 'isomorphic-dompurify'
import crypto from 'crypto'
import { getRandomUnsplashImage } from './unsplash'

const parser = new Parser({
  timeout: Number(process.env.FETCH_TIMEOUT) || 30000,
  customFields: {
    item: [
      ['content:encoded', 'contentEncoded'],
      ['description', 'description'],
      ['media:content', 'mediaContent'],
      ['media:thumbnail', 'mediaThumbnail'],
      ['enclosure', 'enclosure'],
      ['itunes:image', 'itunesImage']
    ]
  }
})

export interface ParsedFeed {
  title: string
  description?: string
  siteUrl?: string
  faviconUrl: string
  items: ParsedArticle[]
}

export interface ParsedArticle {
  guid: string
  title: string
  url: string
  author?: string
  content?: string
  summary?: string
  imageUrl?: string
  publishedAt?: Date
}

/**
 * Generate a stable GUID for an article using fallback logic
 */
function generateGuid(item: any): string {
  // Prefer guid, then link, then hash of title + pubDate
  if (item.guid) return item.guid
  if (item.link) return item.link

  const hashInput = `${item.title || ''}|${item.pubDate || ''}`
  return crypto.createHash('md5').update(hashInput).digest('hex')
}

/**
 * Extract domain from URL for favicon
 */
function extractDomain(url: string): string {
  try {
    const urlObj = new URL(url)
    return urlObj.hostname
  } catch {
    return ''
  }
}

/**
 * Sanitize HTML content to prevent XSS
 */
function sanitizeHtml(html: string | undefined): string | undefined {
  if (!html) return undefined

  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      'p', 'br', 'strong', 'em', 'u', 'a', 'ul', 'ol', 'li',
      'blockquote', 'code', 'pre', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'img', 'figure', 'figcaption', 'table', 'thead', 'tbody', 'tr', 'th', 'td'
    ],
    ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'target', 'rel']
  })
}

/**
 * Normalize and validate date
 */
function normalizeDate(dateStr: string | undefined): Date | undefined {
  if (!dateStr) return undefined

  try {
    const date = new Date(dateStr)

    // Check if date is valid
    if (isNaN(date.getTime())) {
      return undefined
    }

    return date
  } catch {
    return undefined
  }
}

/**
 * Extract image URL from RSS item using multiple strategies
 * Falls back to Unsplash random image if nothing found
 */
async function extractImageUrl(item: any, rawContent?: string): Promise<string | undefined> {

  // 1. Try enclosure (if it's an image)
  if (item.enclosure?.url) {
    const enclosureType = item.enclosure.type || ''
    if (enclosureType.startsWith('image/')) {
      return item.enclosure.url
    }
  }

  // 2. Try media:content or media:thumbnail
  if (item.mediaContent?.$?.url) {
    return item.mediaContent.$.url
  }
  if (item.mediaThumbnail?.$?.url) {
    return item.mediaThumbnail.$.url
  }

  // 3. Try itunes:image
  if (item.itunesImage?.$?.href) {
    return item.itunesImage.$.href
  }
  if (item.itunes?.image) {
    return item.itunes.image
  }

  // 4. Extract first <img> tag from HTML content
  if (rawContent) {
    const imgMatch = rawContent.match(/<img[^>]+src=["']([^"']+)["']/i)
    if (imgMatch?.[1]) {
      return imgMatch[1]
    }
  }

  // 5. Fallback to Unsplash random image
  const unsplashImage = await getRandomUnsplashImage()
  if (unsplashImage) {
    return unsplashImage
  }

  return undefined
}

/**
 * Parse RSS/Atom feed from URL
 */
export async function parseFeed(url: string): Promise<ParsedFeed> {
  try {
    const feed = await parser.parseURL(url)

    if (!feed.title) {
      throw new Error('Feed has no title')
    }

    // Extract domain for favicon
    const domain = extractDomain(feed.link || url)
    const faviconUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=32`

    const items: ParsedArticle[] = await Promise.all(
      feed.items.map(async (item) => {
        // Extract content (prefer full content over description)
        const rawContent = (item as any).contentEncoded || item.content || item.description
        const rawSummary = item.contentSnippet || item.description

        return {
          guid: generateGuid(item),
          title: item.title || 'Untitled',
          url: item.link || '',
          author: item.creator || item.author,
          content: sanitizeHtml(rawContent),
          summary: rawSummary ? rawSummary.substring(0, 500) : undefined,
          imageUrl: await extractImageUrl(item, rawContent),
          publishedAt: normalizeDate(item.pubDate)
        }
      })
    )

    return {
      title: feed.title,
      description: feed.description,
      siteUrl: feed.link,
      faviconUrl,
      items
    }
  } catch (error: any) {
    // Provide user-friendly error messages
    if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
      throw new Error('Unable to reach feed URL. Please check the URL and try again.')
    }
    if (error.code === 'ETIMEDOUT') {
      throw new Error('Feed request timed out. The server may be slow or unreachable.')
    }
    if (error.message?.includes('Invalid XML')) {
      throw new Error('Invalid RSS/Atom feed format.')
    }

    throw new Error(`Failed to parse feed: ${error.message}`)
  }
}
