import { rigForUrl } from '~/server/utils/feedRigs'
import { smbcRig } from '~/server/utils/feedRigs/smbc'
import { oglafRig } from '~/server/utils/feedRigs/oglaf'
import { daringFireballRig } from '~/server/utils/feedRigs/daringfireball'
import { xkcdRig } from '~/server/utils/feedRigs/xkcd'
import { oatmealRig } from '~/server/utils/feedRigs/oatmeal'
import { pluralisticRig, trimPluralisticBody } from '~/server/utils/feedRigs/pluralistic'
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
    expect(rigForUrl('https://daringfireball.net/feeds/main')?.id).toBe('daringfireball')
    expect(rigForUrl('https://xkcd.com/rss.xml')?.id).toBe('xkcd')
    expect(rigForUrl('https://theoatmeal.com/feed/rss')?.id).toBe('oatmeal')
    expect(rigForUrl('https://pluralistic.net/feed/')?.id).toBe('pluralistic')
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

describe('daringFireballRig.entry', () => {
  it('marks every entry complete-as-delivered and keeps the body untouched', () => {
    const item = baseItem({
      title: 'Paper',
      url: 'https://paper.design/',
      content: '<p>Commentary from Gruber about Paper.</p>'
    })
    const rigged = daringFireballRig.entry!(item)
    expect(rigged.fullTextComplete).toBe(true)
    expect(rigged.content).toBe(item.content)
    expect(rigged.title).toBe('Paper')
  })
})

describe('xkcdRig.entry', () => {
  // Real shape from the xkcd RSS description.
  const rssContent =
    '<img src="https://imgs.xkcd.com/comics/arthurian_connector.png" ' +
    'title="Most coffee shops have a descendant of Sophia of Hanover on staff." ' +
    'alt="Most coffee shops" />'

  it('renders image + caption from the title attribute and marks complete', () => {
    const rigged = xkcdRig.entry!(baseItem({ title: 'Arthurian Connector', content: rssContent }))
    expect(rigged.content).toContain('src="https://imgs.xkcd.com/comics/arthurian_connector.png"')
    expect(rigged.content).toContain('<em>Most coffee shops have a descendant of Sophia of Hanover on staff.</em>')
    expect(rigged.summary).toBe('Most coffee shops have a descendant of Sophia of Hanover on staff.')
    expect(rigged.imageUrl).toBe('https://imgs.xkcd.com/comics/arthurian_connector.png')
    expect(rigged.fullTextComplete).toBe(true)
  })

  it('leaves an imageless body untouched', () => {
    const item = baseItem({ content: '<p>Announcement post, no comic.</p>' })
    expect(xkcdRig.entry!(item)).toBe(item)
  })
})

describe('xkcdRig.extract', () => {
  it('pulls the comic + caption from #comic, resolving the protocol-relative src', async () => {
    const html =
      '<div id="topContainer">chrome</div>' +
      '<div id="comic"><img src="//imgs.xkcd.com/comics/arthurian_connector.png" title="The joke." alt="alt"/></div>' +
      '<div id="bottom">footer chrome with <img src="//imgs.xkcd.com/s/a899e84.jpg"></div>'
    const result = await xkcdRig.extract!({ url: 'https://xkcd.com/3274/', html, fetchPage: async () => null })
    expect(result!.html).toContain('src="https://imgs.xkcd.com/comics/arthurian_connector.png"')
    expect(result!.html).toContain('<em>The joke.</em>')
    expect(result!.html).not.toContain('a899e84')
    expect(result!.imageUrl).toBe('https://imgs.xkcd.com/comics/arthurian_connector.png')
  })

  it('returns null when the page has no #comic (falls back to the generic path)', async () => {
    const result = await xkcdRig.extract!({ url: 'https://xkcd.com/', html: '<p>news</p>', fetchPage: async () => null })
    expect(result).toBeNull()
  })
})

describe('oatmealRig.entry', () => {
  it('drops the "View on my website" link and trailing breaks', () => {
    const content =
      '<a href="http://theoatmeal.com/blog/jimothy?no_popup=1"><img width="600" src="https://s3.amazonaws.com/theoatmeal-img/thumbnails/jimothy_big.png" alt="Jimothy" class="border0" /></a>' +
      '<p>I drew a raccoon and other important updates.</p>' +
      '<a href="http://theoatmeal.com/blog/jimothy?no_popup=1">View on my website</a><br /><br />'
    const rigged = oatmealRig.entry!(baseItem({ content }))
    expect(rigged.content).toContain('jimothy_big.png')
    expect(rigged.content).toContain('I drew a raccoon')
    expect(rigged.content).not.toContain('View on my website')
    expect(rigged.content).not.toMatch(/<br\s*\/?>\s*$/)
  })

  it('returns the item untouched without the link', () => {
    const item = baseItem({ content: '<p>plain</p>' })
    expect(oatmealRig.entry!(item)).toBe(item)
  })
})

describe('oatmealRig.extract', () => {
  const page =
    '<img src="https://s3.amazonaws.com/theoatmeal-img/thumbnails/creativity_things_big.png" alt="" />' +
    '<img class="faint_border" src="https://s3.amazonaws.com/theoatmeal-img/comics/creativity_things/1.png" alt="" />' +
    '<img class="faint_border" src="https://s3.amazonaws.com/theoatmeal-img/comics/creativity_things/2.png" alt="" />' +
    '<img class="faint_border" src="https://s3.amazonaws.com/theoatmeal-img/comics/creativity_things/3.png" alt="" />' +
    '<img style="width: 40%;" class="border2" src="https://s3.amazonaws.com/theoatmeal-img/thumbnails/creativity_erasers_big.png" alt="" />'

  it('collects the panel sequence and skips thumbnails', async () => {
    const result = await oatmealRig.extract!({
      url: 'https://theoatmeal.com/comics/creativity_things',
      html: page,
      fetchPage: async () => null
    })
    const srcs = [...result!.html.matchAll(/src="([^"]+)"/g)].map((m) => m[1])
    expect(srcs).toEqual([
      'https://s3.amazonaws.com/theoatmeal-img/comics/creativity_things/1.png',
      'https://s3.amazonaws.com/theoatmeal-img/comics/creativity_things/2.png',
      'https://s3.amazonaws.com/theoatmeal-img/comics/creativity_things/3.png'
    ])
    expect(result!.imageUrl).toBe('https://s3.amazonaws.com/theoatmeal-img/comics/creativity_things/1.png')
  })

  it('returns null on a page without panels (blog posts fall back to Readability)', async () => {
    const result = await oatmealRig.extract!({
      url: 'https://theoatmeal.com/blog/jimothy',
      html: '<p>blog post</p><img src="https://s3.amazonaws.com/theoatmeal-img/thumbnails/x.png">',
      fetchPage: async () => null
    })
    expect(result).toBeNull()
  })
})

describe('pluralisticRig (trimPluralisticBody)', () => {
  const body =
    '<!--\nTags:\nkill sticky, dark patterns\n\nSummary:\nDealing with dickovers\n-->\n' +
    '<p><a href="https://pluralistic.net/2026/07/21/dickovers/"><img class="xmasthead_link" src="https://i0.wp.com/craphound.com/images/21Jul2026.jpg"/></a></p>\n' +
    '<h1 class="toch1">Today\'s links</h1>\n' +
    '<ul class="toc">\n<li class="xToC"><a href="#block-element">Dealing with dickovers</a></li>\n<li class="xToC"><a href="#upcoming">Upcoming appearances</a></li>\n</ul>\n' +
    '<hr/>\n<a name="block-element">\n<h1>Dealing with dickovers (<a href="#block-element">permalink</a>)</h1>\n<p>The essay itself.</p>\n' +
    '<hr/>\n<a name="linkdump">\n<h1 heds="0">Hey look at this (<a href="#linkdump">permalink</a>)</h1>\n<p>Delights to delectate.</p>\n' +
    '<hr/>\n<a name="retro">\n<h1 heds="0">Object permanence (<a href="#retro">permalink</a>)</h1>\n<p>This day in history.</p>\n' +
    '<hr/>\n<a name="upcoming">\n<h1 heds="0">Upcoming appearances (<a href="#upcoming">permalink</a>)</h1>\n<p>Edinburgh, Sydney.</p>\n' +
    '<hr/>\n<a name="bragsheet">\n<h1 heds="0">Colophon</h1>\n<p>ISSN: 3066-764X</p>'

  it('keeps the essay, linkdump, and retro; drops comment, ToC, and the boilerplate tail', () => {
    const trimmed = trimPluralisticBody(body)
    expect(trimmed).toContain('The essay itself.')
    expect(trimmed).toContain('Delights to delectate.')
    expect(trimmed).toContain('This day in history.')
    expect(trimmed).toContain('xmasthead_link')
    expect(trimmed).not.toContain('Tags:')
    expect(trimmed).not.toContain("Today's links")
    expect(trimmed).not.toContain('Upcoming appearances')
    expect(trimmed).not.toContain('ISSN')
  })

  it('entry applies the trim and falls back untouched without the anchor', () => {
    const rigged = pluralisticRig.entry!(baseItem({ content: body }))
    expect(rigged.content).not.toContain('ISSN')
    const plain = baseItem({ content: '<p>A one-off post with no sections.</p>' })
    expect(pluralisticRig.entry!(plain)).toBe(plain)
  })
})
