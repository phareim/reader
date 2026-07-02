import { extract } from '@extractus/feed-extractor'
import { extractImageUrl } from './feedImage'

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
 * A raw (pre-normalization) entry field from fast-xml-parser: usually a string,
 * but an element with attributes arrives as `{'#text': …, '@_…': …}`.
 */
function rawEntryText(value: any): string | undefined {
  if (typeof value === 'string') return value
  if (value && typeof value['#text'] === 'string') return value['#text']
  return undefined
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
          // normalization strips HTML from the entry body — keep the raw markup
          // (RSS `description`, Atom `content`/`summary`) so image-led feeds
          // (comics) don't lose their <img> body.
          descriptionHtml:
            rawEntryText(entry.description) ||
            rawEntryText(entry.content) ||
            rawEntryText(entry.summary),
          mediaContent: entry['media:content'],
          mediaThumbnail: entry['media:thumbnail'],
          mediaGroup: entry['media:group'],
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
        // Extract content: full content, else the raw description HTML —
        // the normalized item.description is tag-stripped and truncated,
        // which loses a comic feed's <img> body entirely.
        const rawContent =
          (item as any).contentEncoded ||
          (item as any).descriptionHtml ||
          item.content ||
          item.description
        const rawSummary = item.summary || item.description

        return {
          guid: await generateGuid(item),
          title: item.title || 'Untitled',
          url: item.link || '',
          author: typeof (item as any).author === 'object' ? ((item as any).author?.name || JSON.stringify((item as any).author)) : (item as any).author,
          content: rawContent, // Sanitization now done client-side
          summary: rawSummary ? rawSummary.substring(0, 500) : undefined,
          imageUrl: extractImageUrl(item, rawContent),
          publishedAt: normalizeDate(item.published)
        }
      })
    )

    return {
      // Feed-level fields can also arrive as `{'#text': …}` objects — Atom
      // `<subtitle type="text">` does (The Verge); feed-extractor normalizes
      // the title but not the description. D1 rejects object bindings.
      title: rawEntryText(feed.title) || feed.title,
      description: rawEntryText(feed.description),
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
