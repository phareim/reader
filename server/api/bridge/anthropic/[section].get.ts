import {
  parseAnthropicListing,
  parseAlignmentHome,
  renderBridgeRss,
  type BridgeItem
} from '~/server/utils/anthropicBridge'

/**
 * RSS bridge for the Anthropic properties that publish no feed of their own.
 * Public (feed sync fetches without cookies; the upstream data is public) —
 * the reader subscribes to its own bridge URLs like any other feed. An
 * upstream failure or an empty parse (markup drift) returns 5xx so feed sync
 * records the error and Sources surfaces the health note instead of silently
 * syncing nothing.
 */

const SECTIONS: Record<string, { url: string; title: string; parse: (html: string) => BridgeItem[] }> = {
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

export default defineEventHandler(async (event) => {
  const section = getRouterParam(event, 'section') ?? ''
  const config = SECTIONS[section]
  if (!config) {
    throw createError({ statusCode: 404, statusMessage: `Unknown bridge section: ${section}` })
  }

  let html: string
  try {
    const response = await fetch(config.url, {
      signal: AbortSignal.timeout(Number(process.env.FETCH_TIMEOUT) || 30000),
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; TheLibrarian/1.0; RSS Reader)',
        Accept: 'text/html'
      }
    })
    if (!response.ok) {
      throw createError({ statusCode: 502, statusMessage: `Upstream ${response.status} from ${config.url}` })
    }
    html = await response.text()
  } catch (error: any) {
    if (error?.statusCode) throw error
    throw createError({ statusCode: 502, statusMessage: `Upstream fetch failed: ${error?.message ?? error}` })
  }

  const items = config.parse(html)
  if (items.length === 0) {
    // A 200 page that parses to nothing means the markup changed under us.
    throw createError({ statusCode: 502, statusMessage: `No items parsed from ${config.url}` })
  }

  setHeader(event, 'Content-Type', 'application/rss+xml; charset=utf-8')
  setHeader(event, 'Cache-Control', 'public, max-age=1800')
  return renderBridgeRss(
    { title: config.title, link: config.url, description: `${config.title} (bridged by The Librarian)` },
    items
  )
})
