import { cleanArticleDom } from '~/utils/cleanArticleContent'
import { processArticleContent } from '~/utils/processArticleContent'

/**
 * Fixtures are distilled from real fetched bodies in the production R2 bucket
 * (Polygon 195878, The Register 196340, LessWrong 205775, Rolling Stone
 * 193516/212177, TechCrunch 194873, Ars 210658).
 */

const clean = (html: string, title?: string) => {
  const div = document.createElement('div')
  div.innerHTML = html
  cleanArticleDom(div, { title })
  return div.innerHTML
}

const text = (html: string) => {
  const div = document.createElement('div')
  div.innerHTML = html
  return (div.textContent || '').replace(/\s+/g, ' ').trim()
}

describe('cleanArticleDom', () => {
  it('removes share-widget chrome (Polygon)', () => {
    const out = clean(
      '<div><p>Follow</p><p>Link copied to clipboard</p><p>Real opening paragraph of the article with plenty of text.</p></div>'
    )
    expect(out).not.toContain('Follow')
    expect(out).not.toContain('Link copied')
    expect(out).toContain('Real opening paragraph')
  })

  it('removes ad-slot placeholders (The Register)', () => {
    const out = clean(
      '<p>First paragraph of prose that is comfortably long enough to be real.</p><div><p>REG AD</p></div><p>Second paragraph continues the article.</p>'
    )
    expect(out).not.toContain('REG AD')
    expect(out).toContain('Second paragraph')
  })

  it('removes recirculation-rail headings but keeps prose after them (Rolling Stone)', () => {
    const out = clean(
      '<p>The album opens strong with a full paragraph of review prose here.</p><h2>Editor’s picks</h2><p>The title track reaches that same destination through different means.</p><h2>Trending Stories</h2><p>Still, the record succeeds because it refuses to repeat itself.</p>'
    )
    expect(out).not.toContain('picks')
    expect(out).not.toContain('Trending Stories')
    expect(out).toContain('title track')
    expect(out).toContain('refuses to repeat')
  })

  it('keeps a legitimate heading that merely contains a rail word', () => {
    const out = clean(
      '<p>Long enough opening paragraph about the subject of this piece.</p><h2>Why related-party transactions matter</h2><p>Body.</p>'
    )
    expect(out).toContain('Why related-party transactions matter')
  })

  it('drops a duplicated title block near the top', () => {
    const out = clean(
      '<p>A Very Simple Game Theory of Pronoun Degendering</p><p>The actual article begins here with a good long first paragraph.</p>',
      'A Very Simple Game Theory of Pronoun Degendering'
    )
    expect(out).not.toContain('Game Theory of Pronoun')
    expect(out).toContain('actual article begins')
  })

  it('trims leading scraps: stray chars and bare karma numbers (LessWrong)', () => {
    const out = clean(
      '<p>x</p><p>Frontpage</p><p>9</p><p>I often vocally argue for a position, and this paragraph is the real start.</p>'
    )
    expect(text(out)).toBe('I often vocally argue for a position, and this paragraph is the real start.')
  })

  it('does not trim numeric paragraphs mid-article', () => {
    const out = clean(
      '<p>The first real paragraph is long enough to anchor the article body.</p><p>42</p><p>That number matters to the story being told here.</p>'
    )
    expect(out).toContain('<p>42</p>')
  })

  it('cuts the comment tail from a comment-count block (Ars)', () => {
    const out = clean(
      '<p>Article prose one, long enough to count as a real block of text.</p><p>Article prose two, also long enough to count as real text.</p><p>71 Comments</p><ul><li>Comment nav</li></ul>'
    )
    expect(out).not.toContain('71 Comments')
    expect(out).not.toContain('Comment nav')
    expect(out).toContain('prose two')
  })

  it('cuts the LessWrong comment section from its first collapsed header', () => {
    const out = clean(
      '<p>First half of the essay, a substantial paragraph of argument.</p><p>Second half of the essay, another substantial paragraph of argument.</p><p>Reply</p><p>[-]HedonicEscalator2h10</p><p>A commenter disagrees at length with the whole premise here.</p><p>Moderation Log</p><p>View more</p>'
    )
    expect(out).not.toContain('HedonicEscalator')
    expect(out).not.toContain('commenter disagrees')
    expect(out).not.toContain('Moderation Log')
    expect(out).toContain('Second half of the essay')
  })

  it('ignores a comment-like block in the first half', () => {
    const out = clean(
      '<p>Comments</p><p>Prose one long enough to be the real body of the article.</p><p>Prose two long enough to be the real body of the article.</p><p>Prose three long enough to be the real body of the article.</p>'
    )
    expect(out).toContain('Prose three')
  })

  it('italicizes affiliate disclosures (TechCrunch / Rolling Stone)', () => {
    const out = clean(
      '<p>When you purchase through links in our articles, we may earn a small commission. This doesn’t affect our editorial independence.</p>'
    )
    expect(out).toContain('article-meta')
  })

  it('italicizes datelines and image credits (Polygon)', () => {
    const out = clean(
      '<p>Published Jul 19, 2026, 1:00 PM EDT</p><p>Image: Legendary Entertainment/Universal</p>'
    )
    expect(out.match(/article-meta/g)?.length).toBe(2)
  })

  it('italicizes fused byline/read-time chips (LessWrong)', () => {
    const out = clean('<p>by BryceStansfield20th Jul 20262 min read3</p>')
    expect(out).toContain('article-meta')
  })

  it('leaves prose that starts with "Published" alone (Rolling Stone)', () => {
    const out = clean(
      '<p>Published on May 2, 2023, Fourth Wing launched Rebecca Yarros’ bestselling Empyrean series.</p>'
    )
    expect(out).not.toContain('article-meta')
  })

  it('leaves prose that starts with "By" alone', () => {
    const out = clean('<p>By contrast, models fail.</p><p>By the time the war ended, everyone had forgotten why it began at all.</p>')
    expect(out).not.toContain('article-meta')
  })

  it('sweeps nested empty blocks but keeps image-only blocks', () => {
    const out = clean(
      '<div><div><p></p><p> </p></div></div><p><img src="https://example.com/a.jpg" alt=""></p><p>Prose.</p>'
    )
    expect(out).not.toContain('<div>')
    expect(out).toContain('<img')
    expect(out).toContain('Prose.')
  })
})

describe('processArticleContent integration', () => {
  it('cleans junk and applies meta styling through the full pipeline', () => {
    const out = processArticleContent(
      '<div><p>Follow</p></div><p>Published Jul 19, 2026, 1:00 PM EDT</p><p>The story itself, with a <a href="https://example.com">link</a> in it.</p>',
      { title: 'Some Title' }
    )!
    expect(out).not.toContain('Follow')
    expect(out).toContain('article-meta')
    expect(out).toContain('target="_blank"')
  })
})
