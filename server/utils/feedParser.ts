import { extract } from '@extractus/feed-extractor'
import { getRandomUnsplashImage } from './unsplash'

const fetchTimeout = Number(process.env.FETCH_TIMEOUT) || 30000

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
async function generateGuid(item: any): Promise<string> {
  // Prefer id/guid, then link, then hash of title + pubDate
  if (item.id) return item.id
  if (item.guid) return item.guid
  if (item.link) return item.link

  const hashInput = `${item.title || ''}|${item.pubDate || item.published || ''}`
  if (globalThis.crypto?.subtle) {
    const data = new TextEncoder().encode(hashInput)
    const digest = await globalThis.crypto.subtle.digest('SHA-256', data)
    return Array.from(new Uint8Array(digest))
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('')
      .slice(0, 32)
  }

  return hashInput
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
 * Note: HTML sanitization is now done client-side in utils/processArticleContent.ts
 * This prevents issues with ESM/CommonJS compatibility in serverless environments
 * and provides defense-in-depth by sanitizing at display time.
 */

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
    const feed = await extract(
      url,
      {
        normalization: true,
        useISODateFormat: false,
        descriptionMaxLen: 500,
        getExtraEntryFields: (entry) => ({
          contentEncoded: entry['content:encoded'],
          mediaContent: entry['media:content'],
          mediaThumbnail: entry['media:thumbnail'],
          enclosure: entry.enclosure,
          itunesImage: entry['itunes:image'],
          itunes: entry.itunes,
          author: entry.author || entry.creator || entry['dc:creator']
        })
      },
      {
        signal: AbortSignal.timeout(fetchTimeout)
      }
    )

    if (!feed.title) {
      throw new Error('Feed has no title')
    }

    // Extract domain for favicon
    const domain = extractDomain(feed.link || url)
    const faviconUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=32`

    const items: ParsedArticle[] = await Promise.all(
      (feed.entries || []).map(async (item) => {
        // Extract content (prefer full content over description)
        const rawContent = (item as any).contentEncoded || item.content || item.description
        const rawSummary = item.summary || item.description

        return {
          guid: await generateGuid(item),
          title: item.title || 'Untitled',
          url: item.link || '',
          author: (item as any).author,
          content: rawContent, // Sanitization now done client-side
          summary: rawSummary ? rawSummary.substring(0, 500) : undefined,
          imageUrl: await extractImageUrl(item, rawContent),
          publishedAt: normalizeDate(item.published)
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
