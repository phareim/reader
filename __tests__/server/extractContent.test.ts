import * as fs from 'fs'
import * as path from 'path'
import { extractReadableContent, extractPlainText, extractLeadImage, acceptExtraction } from '~/server/utils/extractContent'

const ARTICLE_URL = 'https://example.com/essays/slow-reading'
const fixture = fs.readFileSync(
  path.join(__dirname, '..', 'fixtures', 'article-sample.html'),
  'utf-8'
)

describe('extractReadableContent', () => {
  it('extracts rich HTML via Readability', () => {
    const result = extractReadableContent(fixture, ARTICLE_URL)
    expect(result).not.toBeNull()
    expect(result!.source).toBe('readability')
    const html = result!.html
    expect(html).toContain('<h2>')
    expect(html).toContain('<em>')
    expect(html).toContain('<strong>')
    expect(html).toContain('<blockquote>')
    expect(html).toContain('<li>')
    expect(html).toContain('<figcaption>')
  })

  it('drops site chrome (nav, header, footer, reader controls)', () => {
    const html = extractReadableContent(fixture, ARTICLE_URL)!.html
    expect(html).not.toContain('Text settings')
    expect(html).not.toContain('Subscribe')
    expect(html).not.toContain('Ten apps to read faster')
    expect(html).not.toContain('Privacy')
  })

  it('resolves relative link and image URLs against the article URL', () => {
    const html = extractReadableContent(fixture, ARTICLE_URL)!.html
    expect(html).toContain('href="https://example.com/archive/slow-reading"')
    expect(html).toContain('src="https://example.com/essays/images/margins.png"')
    expect(html).toContain('https://example.org/notes')
  })

  it('resolves srcset candidates to absolute URLs', () => {
    const html = extractReadableContent(fixture, ARTICLE_URL)!.html
    expect(html).toContain('https://example.com/essays/images/margins-2x.png 2x')
  })

  it('promotes lazy data-src images to src', () => {
    const html = extractReadableContent(fixture, ARTICLE_URL)!.html
    expect(html).toContain('https://example.com/images/desk-lamp.jpg')
    expect(html).not.toContain('data:image/gif')
  })

  it('falls back to paragraphized plain text when Readability finds nothing', () => {
    const sentence =
      'This is a long enough sentence of plain prose to clear the minimum extraction threshold for the fallback path. '
    const junk = `<html><body><div>${sentence.repeat(3)}</div><div>${sentence.repeat(3)}</div></body></html>`
    const result = extractReadableContent(junk, ARTICLE_URL)
    expect(result).not.toBeNull()
    expect(result!.html).toContain('<p>')
  })

  it('returns null for pages with too little content', () => {
    expect(extractReadableContent('<html><body><p>Tiny.</p></body></html>', ARTICLE_URL)).toBeNull()
  })
})

describe('extractLeadImage', () => {
  const page = (head: string) => `<html><head>${head}</head><body><p>Body.</p></body></html>`

  it('reads og:image from the page head', () => {
    const html = page('<meta property="og:image" content="https://example.com/lead.jpg">')
    expect(extractLeadImage(html, ARTICLE_URL)).toBe('https://example.com/lead.jpg')
  })

  it('resolves a relative og:image against the article URL', () => {
    const html = page('<meta property="og:image" content="/images/lead.jpg">')
    expect(extractLeadImage(html, ARTICLE_URL)).toBe('https://example.com/images/lead.jpg')
  })

  it('prefers og:image:secure_url and falls back to twitter:image', () => {
    const secure = page(
      '<meta property="og:image:secure_url" content="https://example.com/secure.jpg">' +
        '<meta property="og:image" content="http://example.com/plain.jpg">'
    )
    expect(extractLeadImage(secure, ARTICLE_URL)).toBe('https://example.com/secure.jpg')

    const twitter = page('<meta name="twitter:image" content="https://example.com/tw.jpg">')
    expect(extractLeadImage(twitter, ARTICLE_URL)).toBe('https://example.com/tw.jpg')
  })

  it('prefers head metadata over the content image', () => {
    const html = page('<meta property="og:image" content="https://example.com/og.jpg">')
    const content = '<p>Text</p><img src="https://example.com/inline.jpg">'
    expect(extractLeadImage(html, ARTICLE_URL, content)).toBe('https://example.com/og.jpg')
  })

  it('falls back to the first <img> in the extracted content', () => {
    const content = '<p>Text</p><img src="https://example.com/inline.jpg" alt="">'
    expect(extractLeadImage(page(''), ARTICLE_URL, content)).toBe('https://example.com/inline.jpg')
  })

  it('rejects non-http schemes (data URIs) and keeps looking', () => {
    const html = page('<meta property="og:image" content="data:image/gif;base64,R0lGOD">')
    const content = '<img src="https://example.com/real.jpg">'
    expect(extractLeadImage(html, ARTICLE_URL, content)).toBe('https://example.com/real.jpg')
    expect(extractLeadImage(html, ARTICLE_URL)).toBeNull()
  })

  it('returns null when the page offers nothing', () => {
    expect(extractLeadImage(page(''), ARTICLE_URL)).toBeNull()
    expect(extractLeadImage(page(''), ARTICLE_URL, '<p>No images.</p>')).toBeNull()
  })
})

describe('extractPlainText', () => {
  it('strips tags and preserves paragraph breaks as newlines', () => {
    const text = extractPlainText('<html><body><p>One.</p><p>Two.</p></body></html>')
    expect(text).toBe('One.\n\nTwo.')
  })

  it('removes script/style/nav content entirely', () => {
    const text = extractPlainText(
      '<html><body><nav>Menu</nav><script>evil()</script><p>Kept.</p></body></html>'
    )
    expect(text).not.toContain('Menu')
    expect(text).not.toContain('evil')
    expect(text).toContain('Kept.')
  })
})

describe('acceptExtraction', () => {
  const longText = (n = 30) => `<p>${'A sentence of decently long article prose. '.repeat(n)}</p>`

  it('accepts a genuine upgrade over a thin excerpt', () => {
    expect(acceptExtraction(longText(), '<p>Short excerpt…</p>', 'https://example.com/og.jpg')).toBe(true)
  })

  it('accepts a long extraction even when the lead image is missing from it', () => {
    // Many sites keep the hero image outside the article body.
    expect(acceptExtraction(longText(), null, 'https://example.com/hero.jpg')).toBe(true)
  })

  it('rejects a still-thin extraction that misses the page lead image (xkcd footer)', () => {
    const footer = '<p><img src="https://xkcd.com/s/banner.jpg">Comics I enjoy: lots of links here.</p>'
    expect(acceptExtraction(footer, '<img src="https://imgs.xkcd.com/comics/comic.png">',
      'https://imgs.xkcd.com/comics/comic.png')).toBe(false)
  })

  it('accepts a thin extraction that carries the lead image (minimal comic pages)', () => {
    const comic = '<p><img src="https://media.example.com/comic/today.jpg" alt="hover text"></p>'
    expect(acceptExtraction(comic, null, 'https://media.example.com/comic/today.jpg')).toBe(true)
  })

  it('accepts a thin extraction when the page has no lead image at all', () => {
    expect(acceptExtraction('<p>A short but complete note.</p>', null, null)).toBe(true)
  })

  it('rejects trading an image-bearing body for an imageless one', () => {
    const existing = `<p><img src="https://pbs.twimg.com/media/pic.jpg"></p>${longText(2)}`
    expect(acceptExtraction(longText(), existing, null)).toBe(false)
  })

  it('rejects an extraction with less visible text than the stored body', () => {
    expect(acceptExtraction('<p>App shell junk.</p>', longText(5), null)).toBe(false)
  })

  it('ignores an empty/whitespace stored body', () => {
    expect(acceptExtraction(longText(), '   ', 'https://example.com/og.jpg')).toBe(true)
  })
})
