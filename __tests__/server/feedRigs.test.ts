import { rigForUrl } from '~/server/utils/feedRigs'
import { smbcRig } from '~/server/utils/feedRigs/smbc'
import { oglafRig } from '~/server/utils/feedRigs/oglaf'
import type { ParsedArticle } from '~/server/utils/feedParser'

const baseItem = (overrides: Partial<ParsedArticle>): ParsedArticle => ({
  guid: 'guid-1',
  title: 'Untitled',
  url: 'https://example.com/x',
  ...overrides
})

describe('rigForUrl', () => {
  it('matches a rig host with and without www', () => {
    expect(rigForUrl('https://www.oglaf.com/feeds/rss/')?.id).toBe('oglaf')
    expect(rigForUrl('https://oglaf.com/disengagement/')?.id).toBe('oglaf')
    expect(rigForUrl('https://www.smbc-comics.com/comic/rss')?.id).toBe('smbc')
  })

  it('returns null for unknown hosts and unparsable URLs', () => {
    expect(rigForUrl('https://example.com/feed')).toBeNull()
    expect(rigForUrl('not a url')).toBeNull()
    expect(rigForUrl(null)).toBeNull()
    expect(rigForUrl(undefined)).toBeNull()
  })
})

describe('smbcRig.entry', () => {
  // Real shape from the SMBC RSS description.
  const rssContent =
    '<a href="https://www.smbc-comics.com/comic/crawl">' +
    '<img src="https://www.smbc-comics.com/comics/1784595902-20260721.png" />' +
    '<br /><br />Click here to go see the bonus panel!</a>' +
    "<p>Hovertext:<br/>I once joked about this back when twitter existed. </p>" +
    "<br />Today's News:<br />"

  const item = baseItem({
    title: 'Saturday Morning Breakfast Cereal - Crawl',
    url: 'https://www.smbc-comics.com/comic/crawl',
    content: rssContent,
    summary: 'Click here to go see the bonus panel! Hovertext: …'
  })

  it('rebuilds the body as comic + hovertext and drops the junk', () => {
    const rigged = smbcRig.entry!(item)
    expect(rigged.content).toContain('src="https://www.smbc-comics.com/comics/1784595902-20260721.png"')
    expect(rigged.content).toContain('<em>I once joked about this back when twitter existed.</em>')
    expect(rigged.content).not.toContain('Click here')
    expect(rigged.content).not.toContain("Today's News")
  })

  it('trims the redundant feed-name title prefix', () => {
    expect(smbcRig.entry!(item).title).toBe('Crawl')
  })

  it('sets the card image and hovertext summary', () => {
    const rigged = smbcRig.entry!(item)
    expect(rigged.imageUrl).toBe('https://www.smbc-comics.com/comics/1784595902-20260721.png')
    expect(rigged.summary).toBe('I once joked about this back when twitter existed.')
  })

  it('leaves an unrecognized body untouched', () => {
    const odd = baseItem({ title: 'Saturday Morning Breakfast Cereal - News', content: '<p>Just prose, no image.</p>' })
    expect(smbcRig.entry!(odd)).toBe(odd)
  })
})

describe('smbcRig.extract', () => {
  const url = 'https://www.smbc-comics.com/comic/crawl'
  // Real shape: title attribute BEFORE src, votey img single-quoted.
  const page =
    '<div id="cc-comic-container">' +
    '<img title="The joke about &quot;crawling&quot;" src="https://www.smbc-comics.com/comics/main.png" id="cc-comic" />' +
    '</div>' +
    '<div id="aftercomic" onclick=\'toggleBlock("aftercomic")\' style="display:none;" class="mobilehide">' +
    "<img src='https://www.smbc-comics.com/comics/after.png'></div>"

  it('builds comic + hovertext + bonus panel', async () => {
    const result = await smbcRig.extract!({ url, html: page, fetchPage: async () => null })
    expect(result).not.toBeNull()
    expect(result!.html).toContain('src="https://www.smbc-comics.com/comics/main.png"')
    expect(result!.html).toContain('<em>The joke about &quot;crawling&quot;</em>')
    expect(result!.html).toContain('src="https://www.smbc-comics.com/comics/after.png"')
    expect(result!.html).toContain('alt="Bonus panel"')
    expect(result!.imageUrl).toBe('https://www.smbc-comics.com/comics/main.png')
  })

  it('survives a missing bonus panel', async () => {
    const noVotey = page.replace(/<div id="aftercomic".*$/, '')
    const result = await smbcRig.extract!({ url, html: noVotey, fetchPage: async () => null })
    expect(result!.html).toContain('comics/main.png')
    expect(result!.html).not.toContain('Bonus panel')
  })

  it('returns null without a comic (falls back to the generic path)', async () => {
    const result = await smbcRig.extract!({ url, html: '<p>maintenance page</p>', fetchPage: async () => null })
    expect(result).toBeNull()
  })
})

describe('oglafRig.entry', () => {
  it('drops the archive banner and keeps the title card', () => {
    const content =
      '<div style="display:block; background-color: #ccc;">' +
      '<p><a href="https://www.oglaf.com/disengagement/"><img src="https://media.oglaf.com/story/ttdisengagement.jpg" /></a></p>' +
      '<p><a href="https://www.oglaf.com/disengagement/"><img src="https://media.oglaf.com/archive/arc-disengagement.jpg" width="400" height="100" border="0" alt="https://www.oglaf.com/disengagement/" /></a></p>' +
      '</div>'
    const rigged = oglafRig.entry!(baseItem({ content }))
    expect(rigged.content).toContain('story/ttdisengagement.jpg')
    expect(rigged.content).not.toContain('arc-disengagement.jpg')
  })

  it('returns the item untouched when there is no banner', () => {
    const item = baseItem({ content: '<p><img src="https://media.oglaf.com/story/tt.jpg"></p>' })
    expect(oglafRig.entry!(item)).toBe(item)
  })
})

describe('oglafRig.extract', () => {
  const stripPage = (slug: string, n: number | null, opts: { next?: string; joke?: string } = {}) =>
    '<div class="content">' +
    '<div id="tt"><img src="https://media.oglaf.com/story/tt.jpg" title="None" /></div>' +
    `<b><img id="strip" src="https://media.oglaf.com/comic/${slug}${n ?? ''}.jpg" \n` +
    `              alt="alt text"\n              title="${opts.joke ?? ''}"\n              /></b>` +
    '<div id="nav">' +
    (opts.next
      ? `<a href="${opts.next}" rel="next" class="button next" accesskey="j">Next</a>`
      : '<span class="button next disabled"></span>') +
    '</div></div>'

  it('renders a single-page strip with its hover-joke caption', async () => {
    const html = stripPage('disengagement', null, { joke: 'Ewww, I’ve got time on my hands' })
    const result = await oglafRig.extract!({
      url: 'https://www.oglaf.com/disengagement/',
      html,
      fetchPage: async () => null
    })
    expect(result!.html).toContain('src="https://media.oglaf.com/comic/disengagement.jpg"')
    expect(result!.html).toContain('<em>Ewww, I’ve got time on my hands</em>')
    expect(result!.imageUrl).toBe('https://media.oglaf.com/comic/disengagement.jpg')
  })

  it('walks a multi-page story and stops at the next story', async () => {
    const page1 = stripPage('cumsprite', 1, { next: '/cumsprite/2/' })
    const page2 = stripPage('cumsprite', 2, { next: '/cumsprite/3/' })
    // The last page's next points at the FOLLOWING story — must not be followed.
    const page3 = stripPage('cumsprite', 3, { next: '/smoke/' })
    const fetched: string[] = []
    const serve: Record<string, string> = {
      'https://www.oglaf.com/cumsprite/2/': page2,
      'https://www.oglaf.com/cumsprite/3/': page3
    }
    const result = await oglafRig.extract!({
      url: 'https://www.oglaf.com/cumsprite/',
      html: page1,
      fetchPage: async (u) => {
        fetched.push(u)
        return serve[u] ?? null
      }
    })
    expect(fetched).toEqual(['https://www.oglaf.com/cumsprite/2/', 'https://www.oglaf.com/cumsprite/3/'])
    const srcs = [...result!.html.matchAll(/src="([^"]+)"/g)].map((m) => m[1])
    expect(srcs).toEqual([
      'https://media.oglaf.com/comic/cumsprite1.jpg',
      'https://media.oglaf.com/comic/cumsprite2.jpg',
      'https://media.oglaf.com/comic/cumsprite3.jpg'
    ])
    expect(result!.imageUrl).toBe('https://media.oglaf.com/comic/cumsprite1.jpg')
  })

  it('keeps the pages it has when a follow-up fetch fails', async () => {
    const page1 = stripPage('story', 1, { next: '/story/2/' })
    const result = await oglafRig.extract!({
      url: 'https://www.oglaf.com/story/',
      html: page1,
      fetchPage: async () => null
    })
    const srcs = [...result!.html.matchAll(/src="([^"]+)"/g)].map((m) => m[1])
    expect(srcs).toEqual(['https://media.oglaf.com/comic/story1.jpg'])
  })

  it('skips empty and "None" captions', async () => {
    const html = stripPage('quiet', null)
    const result = await oglafRig.extract!({
      url: 'https://www.oglaf.com/quiet/',
      html,
      fetchPage: async () => null
    })
    expect(result!.html).not.toContain('<em>')
  })

  it('returns null when the page carries no strip', async () => {
    const result = await oglafRig.extract!({
      url: 'https://www.oglaf.com/broken/',
      html: '<p>server hiccup</p>',
      fetchPage: async () => null
    })
    expect(result).toBeNull()
  })
})
