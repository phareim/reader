import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  parseAnthropicListing,
  parseAlignmentHome,
  renderBridgeRss,
  decodeFlightPayload,
  bridgeSectionForUrl,
  BRIDGE_ITEM_CAP
} from '~/server/utils/anthropicBridge'

describe('bridgeSectionForUrl', () => {
  it('recognizes our own bridge feed URLs (a Worker cannot fetch itself)', () => {
    expect(bridgeSectionForUrl('https://reader.phareim.no/api/bridge/anthropic/news')).toBe('news')
    expect(bridgeSectionForUrl('https://reader.phareim.no/api/bridge/anthropic/engineering/')).toBe('engineering')
    expect(bridgeSectionForUrl('http://localhost:3000/api/bridge/anthropic/alignment')).toBe('alignment')
  })

  it('ignores foreign hosts, unknown sections, and junk', () => {
    expect(bridgeSectionForUrl('https://example.com/api/bridge/anthropic/news')).toBeNull()
    expect(bridgeSectionForUrl('https://reader.phareim.no/api/bridge/anthropic/red')).toBeNull()
    expect(bridgeSectionForUrl('https://transformer-circuits.pub/feed.xml')).toBeNull()
    expect(bridgeSectionForUrl('not a url')).toBeNull()
  })
})

const fixture = (name: string) => readFileSync(join(__dirname, '../fixtures', name), 'utf8')

describe('decodeFlightPayload', () => {
  it('decodes and concatenates [1,"…"] flight chunks', () => {
    const html = '<script>self.__next_f.push([1,"{\\"a\\":1,"])</script>' +
      '<script>self.__next_f.push([1,"\\"b\\":2}"])</script>'
    expect(decodeFlightPayload(html)).toBe('{"a":1,"b":2}')
  })

  it('skips malformed chunks without losing the rest', () => {
    const html = 'self.__next_f.push([1,"good"])'
    expect(decodeFlightPayload(html)).toBe('good')
    expect(decodeFlightPayload('no flight here')).toBe('')
  })
})

describe('parseAnthropicListing — news', () => {
  const html = fixture('anthropic-news-listing.html')

  it('extracts the listed articles with flight titles, dates, summaries, and card images', () => {
    const items = parseAnthropicListing(html, 'news')
    expect(items.length).toBe(4)
    const opus = items.find((i) => i.url.endsWith('/news/claude-opus-5'))
    expect(opus?.title).toBe('Introducing Claude Opus 5')
    expect(opus?.publishedAt).toBe('2026-07-24T17:00:00.000Z')
    expect(opus?.summary).toBeTruthy()
    expect(opus?.imageUrl).toMatch(/^https:\/\/cdn\.sanity\.io\//)
    for (const item of items) {
      expect(item.url).toMatch(/^https:\/\/www\.anthropic\.com\/news\/[a-z0-9-]+$/)
    }
  })

  it('orders dated items newest first', () => {
    const dates = parseAnthropicListing(html, 'news').map((i) => i.publishedAt ?? '')
    expect([...dates].sort().reverse()).toEqual(dates)
  })

  it('fails soft to an empty list on non-listing HTML', () => {
    expect(parseAnthropicListing('<html><body>maintenance</body></html>', 'news')).toEqual([])
    expect(parseAnthropicListing('', 'news')).toEqual([])
  })
})

describe('parseAnthropicListing — engineering', () => {
  it('reads engineeringArticle flight objects (dates, cardImage)', () => {
    const items = parseAnthropicListing(fixture('anthropic-engineering-listing.html'), 'engineering')
    expect(items.length).toBe(3)
    const contain = items.find((i) => i.url.endsWith('/engineering/how-we-contain-claude'))
    expect(contain?.title).toBe('How we contain Claude across products')
    expect(contain?.publishedAt).toBe('2026-05-25T00:00:00.000Z')
    expect(contain?.imageUrl).toMatch(/^https:\/\/cdn\.sanity\.io\//)
  })
})

describe('parseAlignmentHome', () => {
  const html = fixture('anthropic-alignment-home.html')

  it('extracts note entries with titles, resolved URLs, and summaries', () => {
    const items = parseAlignmentHome(html)
    expect(items.length).toBeGreaterThanOrEqual(5)
    for (const item of items) {
      expect(item.url).toMatch(/^https:\/\/alignment\.anthropic\.com\/20\d\d\//)
      expect(item.title).toBeTruthy()
    }
  })

  it('associates month dividers with the notes that follow them', () => {
    const items = parseAlignmentHome(html)
    const july = items.find((i) => i.url.includes('agentic-misalignment-summer-2026'))
    const june = items.find((i) => i.url.includes('diffuse-ai-control'))
    expect(july?.publishedAt).toBe('2026-07-01T00:00:00.000Z')
    expect(june?.publishedAt).toBe('2026-06-01T00:00:00.000Z')
  })

  it('fails soft to an empty list on unexpected HTML', () => {
    expect(parseAlignmentHome('<html><body><p>nothing</p></body></html>')).toEqual([])
  })
})

describe('renderBridgeRss', () => {
  const channel = { title: 'Anthropic News', link: 'https://www.anthropic.com/news', description: 'Bridge' }

  it('renders escaped RSS 2.0 with pubDate, description, and media:content', () => {
    const xml = renderBridgeRss(channel, [{
      title: 'Ampersands & <angles>',
      url: 'https://www.anthropic.com/news/a?b=1&c=2',
      publishedAt: '2026-07-24T17:00:00.000Z',
      summary: 'A "quoted" summary',
      imageUrl: 'https://cdn.sanity.io/x.png'
    }])
    expect(xml).toContain('<title>Ampersands &amp; &lt;angles&gt;</title>')
    expect(xml).toContain('<link>https://www.anthropic.com/news/a?b=1&amp;c=2</link>')
    expect(xml).toContain('<guid isPermaLink="true">')
    expect(xml).toContain('<pubDate>Fri, 24 Jul 2026 17:00:00 GMT</pubDate>')
    expect(xml).toContain('<description>A &quot;quoted&quot; summary</description>')
    expect(xml).toContain('<media:content url="https://cdn.sanity.io/x.png" medium="image"/>')
    expect(xml).toMatch(/^<\?xml version="1\.0" encoding="UTF-8"\?>/)
  })

  it('omits optional fields when absent and caps the item count', () => {
    const many = Array.from({ length: 30 }, (_, i) => ({
      title: `Item ${i}`,
      url: `https://www.anthropic.com/news/item-${i}`
    }))
    const xml = renderBridgeRss(channel, many)
    expect((xml.match(/<item>/g) ?? []).length).toBe(BRIDGE_ITEM_CAP)
    expect(xml).not.toContain('<pubDate>')
    expect(xml).not.toContain('<media:content')
  })
})
