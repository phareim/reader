import { parseHTML } from 'linkedom/worker'
import { escapeHtml } from '~/server/utils/feedRigs/rigHtml'

/**
 * Anthropic publishes no RSS for anthropic.com/news, /engineering, or the
 * alignment blog, so the reader bridges them itself: these pure parsers turn
 * the public listing pages into feed items, and renderBridgeRss() serves them
 * as minimal RSS 2.0 (route: /api/bridge/anthropic/[section]).
 *
 * news/engineering listings are Next.js pages whose card data ships in the
 * flight payload (self.__next_f) as `{"_type":"post", …}` objects carrying
 * title/slug/publishedOn/summary/cardPhoto — richer and more stable than the
 * rendered DOM, which only provides the section's anchor hrefs. The DOM
 * anchors act as the section filter (the flight stream also carries posts
 * from widgets pointing at other sections).
 */

export interface BridgeItem {
  title: string
  url: string
  /** ISO timestamp; absent when the listing doesn't date the entry. */
  publishedAt?: string
  summary?: string
  imageUrl?: string
}

export const BRIDGE_ITEM_CAP = 20

/** Decode the concatenated Next.js flight stream from a page's script tags. */
export function decodeFlightPayload(html: string): string {
  const parts: string[] = []
  const re = /self\.__next_f\.push\(\[1,"((?:[^"\\]|\\.)*)"\]\)/g
  for (const m of html.matchAll(re)) {
    try {
      parts.push(JSON.parse(`"${m[1]}"`))
    } catch {
      // a malformed chunk loses only itself
    }
  }
  return parts.join('')
}

interface FlightPost {
  title?: string
  publishedOn?: string
  summary?: string
  slug?: { current?: string }
  cardPhoto?: { url?: string }
  cardImage?: { url?: string }
}

// News cards are `post` objects; engineering cards are `engineeringArticle`.
const FLIGHT_MARKERS = ['{"_type":"post"', '{"_type":"engineeringArticle"']

/** Balanced-brace scan for the card objects in the flight text. */
function flightPosts(flight: string): FlightPost[] {
  const posts: FlightPost[] = []
  for (const marker of FLIGHT_MARKERS) scanMarker(flight, marker, posts)
  return posts
}

function scanMarker(flight: string, marker: string, posts: FlightPost[]): void {
  let from = 0
  while (true) {
    const start = flight.indexOf(marker, from)
    if (start === -1) break
    from = start + marker.length
    let depth = 0
    let inString = false
    for (let i = start; i < Math.min(flight.length, start + 20000); i++) {
      const ch = flight[i]
      if (inString) {
        if (ch === '\\') i++
        else if (ch === '"') inString = false
      } else if (ch === '"') inString = true
      else if (ch === '{') depth++
      else if (ch === '}') {
        depth--
        if (depth === 0) {
          try {
            posts.push(JSON.parse(flight.slice(start, i + 1)))
          } catch {
            // truncated or non-JSON — skip
          }
          break
        }
      }
    }
  }
}

/** Parse an anthropic.com listing page (news or engineering) into items. */
export function parseAnthropicListing(
  html: string,
  section: 'news' | 'engineering',
  baseUrl = 'https://www.anthropic.com'
): BridgeItem[] {
  const slugs = listedSlugs(html, section)
  if (slugs.length === 0) return []

  const bySlug = new Map<string, FlightPost>()
  for (const post of flightPosts(decodeFlightPayload(html))) {
    const slug = post.slug?.current
    if (slug && !bySlug.has(slug)) bySlug.set(slug, post)
  }

  const items: BridgeItem[] = []
  for (const slug of slugs) {
    const post = bySlug.get(slug)
    if (!post?.title) continue
    items.push({
      title: post.title,
      url: `${baseUrl}/${section}/${slug}`,
      publishedAt: isoDate(post.publishedOn),
      summary: post.summary || undefined,
      imageUrl: httpOnly(post.cardPhoto?.url ?? post.cardImage?.url)
    })
  }

  // The DOM leads with featured cards, not chronology — sort dated items
  // newest first, keep undated ones behind them in listing order.
  return items.sort((a, b) => (b.publishedAt ?? '').localeCompare(a.publishedAt ?? ''))
}

/** The section's article slugs from the rendered DOM, in listing order. */
function listedSlugs(html: string, section: string): string[] {
  const seen = new Set<string>()
  const re = new RegExp(`<a[^>]+href="/${section}/([a-z0-9-]+)"`, 'g')
  for (const m of html.matchAll(re)) seen.add(m[1])
  return [...seen]
}

/** Parse the alignment blog homepage (Distill-style static listing). */
export function parseAlignmentHome(
  html: string,
  baseUrl = 'https://alignment.anthropic.com'
): BridgeItem[] {
  try {
    const { document } = parseHTML(html)
    const items: BridgeItem[] = []
    let currentDate: string | undefined
    // Month dividers (`<div class="date">July 2026</div>`) precede the
    // `a.note` entries they label — walk in document order.
    for (const el of document.querySelectorAll('div.date, a.note')) {
      if (el.matches('div.date')) {
        currentDate = monthToIso(el.textContent ?? '')
        continue
      }
      const href = el.getAttribute('href')
      const title = el.querySelector('h3')?.textContent?.trim()
      if (!href || !title) continue
      const url = resolveHttp(href, baseUrl)
      if (!url) continue
      items.push({
        title,
        url,
        publishedAt: currentDate,
        summary: el.querySelector('.description')?.textContent?.replace(/\s+/g, ' ').trim() || undefined
      })
    }
    return items
  } catch {
    return []
  }
}

const MONTHS: Record<string, string> = {
  january: '01', february: '02', march: '03', april: '04', may: '05', june: '06',
  july: '07', august: '08', september: '09', october: '10', november: '11', december: '12'
}

function monthToIso(text: string): string | undefined {
  const m = text.trim().match(/^([A-Za-z]+)\s+(\d{4})$/)
  const month = m ? MONTHS[m[1].toLowerCase()] : undefined
  return month ? `${m![2]}-${month}-01T00:00:00.000Z` : undefined
}

function isoDate(value: string | undefined): string | undefined {
  if (!value) return undefined
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString()
}

function httpOnly(value: string | null | undefined): string | undefined {
  if (!value) return undefined
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : undefined
  } catch {
    return undefined
  }
}

function resolveHttp(value: string, base: string): string | null {
  try {
    const url = new URL(value, base)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null
  } catch {
    return null
  }
}

export type BridgeSection = 'news' | 'engineering' | 'alignment'

export const BRIDGE_SECTIONS: Record<BridgeSection, { url: string; title: string; parse: (html: string) => BridgeItem[] }> = {
  news: {
    url: 'https://www.anthropic.com/news',
    title: 'Anthropic News',
    parse: (html) => parseAnthropicListing(html, 'news')
  },
  engineering: {
    url: 'https://www.anthropic.com/engineering',
    title: 'Anthropic Engineering',
    parse: (html) => parseAnthropicListing(html, 'engineering')
  },
  alignment: {
    url: 'https://alignment.anthropic.com/',
    title: 'Anthropic Alignment Science',
    parse: (html) => parseAlignmentHome(html)
  }
}

// Hosts on which a bridge feed URL points back at THIS app. A Cloudflare
// Worker cannot fetch its own hostname (self-subrequests are blocked), so
// feed sync must recognize these URLs and build the XML in-process instead.
const OWN_HOSTS = new Set(['reader.phareim.no', 'localhost', '127.0.0.1'])

/** The bridge section a subscribed feed URL refers to, when it is ours. */
export function bridgeSectionForUrl(feedUrl: string): BridgeSection | null {
  try {
    const url = new URL(feedUrl)
    if (!OWN_HOSTS.has(url.hostname.toLowerCase())) return null
    const m = url.pathname.match(/^\/api\/bridge\/anthropic\/(news|engineering|alignment)\/?$/)
    return (m?.[1] as BridgeSection) ?? null
  } catch {
    return null
  }
}

/**
 * Fetch the section's upstream listing and render it as RSS. Throws on
 * upstream failure or an empty parse (markup drift) so both the route and
 * feed sync surface the error instead of silently serving nothing.
 */
export async function buildBridgeXml(section: BridgeSection): Promise<string> {
  const config = BRIDGE_SECTIONS[section]
  const response = await fetch(config.url, {
    signal: AbortSignal.timeout(Number(process.env.FETCH_TIMEOUT) || 30000),
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; TheLibrarian/1.0; RSS Reader)',
      Accept: 'text/html'
    }
  })
  if (!response.ok) throw new Error(`Upstream ${response.status} from ${config.url}`)

  const items = config.parse(await response.text())
  if (items.length === 0) throw new Error(`No items parsed from ${config.url}`)

  return renderBridgeRss(
    { title: config.title, link: config.url, description: `${config.title} (bridged by The Librarian)` },
    items
  )
}

export interface BridgeChannel {
  title: string
  link: string
  description: string
}

/** Render items as minimal RSS 2.0 (capped at BRIDGE_ITEM_CAP, given order). */
export function renderBridgeRss(channel: BridgeChannel, items: BridgeItem[]): string {
  const itemXml = items.slice(0, BRIDGE_ITEM_CAP).map((item) => {
    const parts = [
      `<title>${escapeHtml(item.title)}</title>`,
      `<link>${escapeHtml(item.url)}</link>`,
      `<guid isPermaLink="true">${escapeHtml(item.url)}</guid>`
    ]
    if (item.publishedAt) parts.push(`<pubDate>${new Date(item.publishedAt).toUTCString()}</pubDate>`)
    if (item.summary) parts.push(`<description>${escapeHtml(item.summary)}</description>`)
    if (item.imageUrl) parts.push(`<media:content url="${escapeHtml(item.imageUrl)}" medium="image"/>`)
    return `    <item>\n      ${parts.join('\n      ')}\n    </item>`
  })

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:media="http://search.yahoo.com/mrss/">',
    '  <channel>',
    `    <title>${escapeHtml(channel.title)}</title>`,
    `    <link>${escapeHtml(channel.link)}</link>`,
    `    <description>${escapeHtml(channel.description)}</description>`,
    ...itemXml,
    '  </channel>',
    '</rss>',
    ''
  ].join('\n')
}
