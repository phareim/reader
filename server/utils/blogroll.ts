import { decodeEntities } from '~/server/utils/htmlEntities'
import { parseHTML } from 'linkedom/worker'

/**
 * Pure blogroll/OPML parsing for the Discover feature (no fetching here —
 * orchestration lives in blogrollCrawl.ts). Real-world OPML is XML in name
 * only (`&nbsp;` and friends abound), so outlines are pulled with a tag
 * regex + decodeEntities like feedDiscovery.ts does for <link> tags, not a
 * strict XML parser.
 */

export interface OpmlOutline {
  title: string | null
  xmlUrl: string | null
  htmlUrl: string | null
}

export interface BlogrollLink {
  url: string
  title: string | null
  host: string
}

/** Fewer external links than this ⇒ the page is nav/404, not a blogroll. */
export const MIN_BLOGROLL_LINKS = 3

/** A blogroll page listing more links than this is a directory — keep the head. */
export const MAX_BLOGROLL_LINKS = 30

export const WELL_KNOWN_OPML_PATHS = ['/.well-known/recommendations.opml', '/blogroll.opml']
export const HTML_BLOGROLL_PATHS = ['/blogroll', '/blogroll/', '/links', '/links/']

/**
 * Platform/aggregator hosts whose blogroll links are never a subscribable
 * personal blog (matched by suffix, so subdomains are covered too).
 * Deliberately NOT substack.com or medium.com — those host real blogs with
 * real feeds.
 */
export const PLATFORM_DOMAINS = new Set([
  'x.com', 'twitter.com', 'youtube.com', 'youtu.be', 'github.com', 'gitlab.com',
  'reddit.com', 'news.ycombinator.com', 'wikipedia.org', 'facebook.com',
  'instagram.com', 'linkedin.com', 'bsky.app', 'mastodon.social', 'threads.net',
  'amazon.com', 'patreon.com', 'ko-fi.com', 'buymeacoffee.com', 'paypal.com',
  'discord.gg', 'discord.com', 't.me', 'telegram.org', 'twitch.tv',
  'tiktok.com', 'pinterest.com', 'spotify.com', 'apple.com', 'google.com',
])

export function isPlatformHost(host: string): boolean {
  for (const domain of PLATFORM_DOMAINS) {
    if (host === domain || host.endsWith('.' + domain)) return true
  }
  return false
}

/** Lowercase hostname with a leading `www.` stripped; null if unparsable. */
export function candidateHost(url: string): string | null {
  try {
    const host = new URL(url).hostname.toLowerCase()
    return host.startsWith('www.') ? host.slice(4) : host
  } catch {
    return null
  }
}

/** Body-sniff for OPML — status 200 + a content-type prove nothing (custom
 *  404 pages and SPA catch-alls lie), so only the body decides. */
export function isOpml(body: string): boolean {
  return /<opml[\s>]/i.test(body.slice(0, 4096))
}

const ATTR_REGEX = /([a-zA-Z_][\w:-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/g

function parseAttrs(tag: string): Record<string, string> {
  const attrs: Record<string, string> = {}
  for (const m of tag.matchAll(ATTR_REGEX)) {
    attrs[m[1].toLowerCase()] = decodeEntities(m[2] ?? m[3] ?? '')
  }
  return attrs
}

/**
 * Every <outline> carrying an xmlUrl or htmlUrl, in document order. Nested
 * category outlines flatten naturally (each tag is matched on its own);
 * outlines with neither URL (pure categories) are dropped. OPML puts the
 * label in `text`, some producers use `title` — either is accepted.
 */
export function parseOpmlOutlines(xml: string): OpmlOutline[] {
  const outlines: OpmlOutline[] = []
  for (const m of xml.matchAll(/<outline\b[^>]*>/gi)) {
    const attrs = parseAttrs(m[0])
    const xmlUrl = attrs['xmlurl'] || null
    const htmlUrl = attrs['htmlurl'] || null
    if (!xmlUrl && !htmlUrl) continue
    outlines.push({
      title: attrs['text'] || attrs['title'] || null,
      xmlUrl,
      htmlUrl,
    })
  }
  return outlines
}

/**
 * The homepage's <link rel="blogroll"> href (the emerging well-known
 * convention), resolved against the post-redirect page URL. `rel` is a
 * token list, so rel="blogroll alternate" counts. Null when absent.
 */
export function extractBlogrollLink(html: string, pageUrl: string): string | null {
  for (const m of html.matchAll(/<link\b[^>]*>/gi)) {
    const attrs = parseAttrs(m[0])
    const rel = (attrs['rel'] || '').toLowerCase().split(/\s+/)
    if (!rel.includes('blogroll') || !attrs['href']) continue
    try {
      return new URL(attrs['href'], pageUrl).toString()
    } catch {
      continue
    }
  }
  return null
}

/**
 * External links from a human-readable blogroll page: http(s) anchors
 * pointing off-origin, platform domains dropped, deduped by host (first
 * wins), anchor text as the provisional title. Capped so a 200-link
 * directory page contributes only its head.
 */
export function extractExternalLinks(
  html: string,
  pageUrl: string,
  opts: { max?: number } = {}
): BlogrollLink[] {
  const max = opts.max ?? MAX_BLOGROLL_LINKS
  const ownHost = candidateHost(pageUrl)
  const { document } = parseHTML(html)
  const links: BlogrollLink[] = []
  const seen = new Set<string>()

  for (const a of document.querySelectorAll('a[href]')) {
    if (links.length >= max) break
    const href = a.getAttribute('href') || ''
    let url: URL
    try {
      url = new URL(href, pageUrl)
    } catch {
      continue
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') continue
    const host = candidateHost(url.toString())
    if (!host || host === ownHost || seen.has(host) || isPlatformHost(host)) continue
    seen.add(host)
    const title = (a.textContent || '').trim()
    links.push({ url: url.toString(), title: title || null, host })
  }
  return links
}
