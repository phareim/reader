import {
  parseOpmlOutlines,
  isOpml,
  extractBlogrollLink,
  extractExternalLinks,
  candidateHost,
  isPlatformHost,
  MAX_BLOGROLL_LINKS,
} from '~/server/utils/blogroll'

describe('parseOpmlOutlines', () => {
  it('parses a flat list of self-closing outlines', () => {
    const xml = `<?xml version="1.0"?><opml version="2.0"><body>
      <outline text="A Blog" xmlUrl="https://a.example/feed.xml" htmlUrl="https://a.example/" />
      <outline text="B Blog" xmlUrl="https://b.example/rss" />
    </body></opml>`
    expect(parseOpmlOutlines(xml)).toEqual([
      { title: 'A Blog', xmlUrl: 'https://a.example/feed.xml', htmlUrl: 'https://a.example/' },
      { title: 'B Blog', xmlUrl: 'https://b.example/rss', htmlUrl: null },
    ])
  })

  it('flattens nested category outlines and drops URL-less categories', () => {
    const xml = `<opml><body>
      <outline text="Tech">
        <outline text="A" xmlUrl="https://a.example/feed" />
        <outline text="B" htmlUrl="https://b.example/" />
      </outline>
    </body></opml>`
    const outlines = parseOpmlOutlines(xml)
    expect(outlines.map((o) => o.title)).toEqual(['A', 'B'])
    expect(outlines[1]).toEqual({ title: 'B', xmlUrl: null, htmlUrl: 'https://b.example/' })
  })

  it('accepts any attribute order, single quotes, and title instead of text', () => {
    const xml = `<opml><body>
      <outline xmlUrl='https://a.example/feed' title='Quoted' htmlUrl='https://a.example'/>
    </body></opml>`
    expect(parseOpmlOutlines(xml)).toEqual([
      { title: 'Quoted', xmlUrl: 'https://a.example/feed', htmlUrl: 'https://a.example' },
    ])
  })

  it('decodes entities in titles and urls', () => {
    const xml = `<opml><body>
      <outline text="Tea &amp; Biscuits" xmlUrl="https://a.example/feed?a=1&amp;b=2" />
    </body></opml>`
    expect(parseOpmlOutlines(xml)[0]).toEqual({
      title: 'Tea & Biscuits',
      xmlUrl: 'https://a.example/feed?a=1&b=2',
      htmlUrl: null,
    })
  })

  it('tolerates HTML entities that break strict XML parsers', () => {
    const xml = `<opml><body>
      <outline text="Spaced&nbsp;Out" xmlUrl="https://a.example/feed" />
    </body></opml>`
    expect(parseOpmlOutlines(xml)).toHaveLength(1)
  })

  it('handles paired (non-self-closing) outline tags', () => {
    const xml = `<opml><body>
      <outline text="A" xmlUrl="https://a.example/feed"></outline>
    </body></opml>`
    expect(parseOpmlOutlines(xml)).toHaveLength(1)
  })

  it('returns [] for non-OPML input', () => {
    expect(parseOpmlOutlines('<html><body>404</body></html>')).toEqual([])
  })
})

describe('isOpml', () => {
  it('accepts an OPML body regardless of declaration noise', () => {
    expect(isOpml('\n<?xml version="1.0" encoding="UTF-8"?>\n<opml version="2.0">')).toBe(true)
    expect(isOpml('<OPML>')).toBe(true)
  })

  it('rejects an HTML body — a custom 404 with a lying content-type', () => {
    expect(isOpml('<!doctype html><html><head><title>Not found</title></head></html>')).toBe(false)
  })

  it('does not match substrings like <opmlx>', () => {
    expect(isOpml('<opmlx>')).toBe(false)
  })
})

describe('extractBlogrollLink', () => {
  const PAGE = 'https://blog.example/'

  it('finds a double-quoted rel=blogroll link and resolves relative hrefs', () => {
    const html = '<head><link rel="blogroll" href="/.well-known/recommendations.opml"></head>'
    expect(extractBlogrollLink(html, PAGE)).toBe('https://blog.example/.well-known/recommendations.opml')
  })

  it('accepts single quotes and reversed attribute order', () => {
    const html = "<link href='https://blog.example/roll.opml' rel='blogroll'/>"
    expect(extractBlogrollLink(html, PAGE)).toBe('https://blog.example/roll.opml')
  })

  it('treats rel as a token list', () => {
    const html = '<link rel="blogroll alternate" href="/roll.opml">'
    expect(extractBlogrollLink(html, PAGE)).toBe('https://blog.example/roll.opml')
  })

  it('ignores other rel values and returns null when absent', () => {
    const html = '<link rel="alternate" type="application/rss+xml" href="/feed.xml">'
    expect(extractBlogrollLink(html, PAGE)).toBeNull()
    expect(extractBlogrollLink('<p>no links</p>', PAGE)).toBeNull()
  })
})

describe('extractExternalLinks', () => {
  const PAGE = 'https://blog.example/blogroll'

  it('keeps off-origin http(s) links with anchor text as title', () => {
    const html = `
      <ul>
        <li><a href="https://friend.example/">A Friend</a></li>
        <li><a href="https://other.example/blog">Other</a></li>
      </ul>`
    expect(extractExternalLinks(html, PAGE)).toEqual([
      { url: 'https://friend.example/', title: 'A Friend', host: 'friend.example' },
      { url: 'https://other.example/blog', title: 'Other', host: 'other.example' },
    ])
  })

  it('drops same-origin, mailto, fragment, and platform links', () => {
    const html = `
      <a href="/about">About</a>
      <a href="https://www.blog.example/archive">Archive</a>
      <a href="mailto:hi@example.com">Mail</a>
      <a href="#top">Top</a>
      <a href="https://twitter.com/someone">Bird</a>
      <a href="https://gist.github.com/someone/abc">Gist</a>
      <a href="https://friend.example/">Friend</a>`
    const links = extractExternalLinks(html, PAGE)
    expect(links).toHaveLength(1)
    expect(links[0].host).toBe('friend.example')
  })

  it('dedupes by host, first link wins', () => {
    const html = `
      <a href="https://friend.example/">Home</a>
      <a href="https://friend.example/archive">Archive</a>`
    const links = extractExternalLinks(html, PAGE)
    expect(links).toHaveLength(1)
    expect(links[0].url).toBe('https://friend.example/')
  })

  it('resolves protocol-relative hrefs', () => {
    const links = extractExternalLinks('<a href="//friend.example/blog">F</a>', PAGE)
    expect(links[0]).toEqual({ url: 'https://friend.example/blog', title: 'F', host: 'friend.example' })
  })

  it('nulls out empty anchor text', () => {
    const links = extractExternalLinks('<a href="https://friend.example/"><img src="x.png"></a>', PAGE)
    expect(links[0].title).toBeNull()
  })

  it('excludes page chrome — the corporate network footer is not a blogroll', () => {
    const html = `
      <header><a href="https://parentcorp.example/">Parent Corp</a></header>
      <nav><a href="https://sister1.example/">Sister Site</a></nav>
      <main>
        <a href="https://friend.example/">A Friend</a>
      </main>
      <footer>
        <div><a href="https://sister2.example/">Variety-ish</a></div>
        <a href="https://sister3.example/">Billboard-ish</a>
      </footer>
      <div role="contentinfo"><a href="https://sister4.example/">Legal</a></div>`
    const links = extractExternalLinks(html, PAGE)
    expect(links.map((l) => l.host)).toEqual(['friend.example'])
  })

  it('drops article-style links — deep or dated paths are not blog recommendations', () => {
    const html = `
      <a href="https://variety.example/2026/film/box-office/big-movie-flops-123/">Article card</a>
      <a href="https://wired.example/story/some-long-piece/part-two/">Deep piece</a>
      <a href="https://friend.example/blog/">Shallow blog</a>
      <a href="https://other.example/">Homepage</a>`
    const links = extractExternalLinks(html, PAGE)
    expect(links.map((l) => l.host)).toEqual(['friend.example', 'other.example'])
  })

  it('caps the number of links', () => {
    const html = Array.from({ length: 50 }, (_, i) => `<a href="https://blog${i}.example/">B${i}</a>`).join('')
    expect(extractExternalLinks(html, PAGE)).toHaveLength(MAX_BLOGROLL_LINKS)
    expect(extractExternalLinks(html, PAGE, { max: 5 })).toHaveLength(5)
  })
})

describe('candidateHost / isPlatformHost', () => {
  it('lowercases and strips www', () => {
    expect(candidateHost('https://WWW.Friend.Example/path')).toBe('friend.example')
  })

  it('returns null for garbage', () => {
    expect(candidateHost('not a url')).toBeNull()
  })

  it('matches platform domains by suffix', () => {
    expect(isPlatformHost('youtube.com')).toBe(true)
    expect(isPlatformHost('gist.github.com')).toBe(true)
    expect(isPlatformHost('mygithub.com')).toBe(false)
    expect(isPlatformHost('friend.example')).toBe(false)
  })
})
