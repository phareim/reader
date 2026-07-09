import { renderTweet, buildIncludeMaps } from '../../server/utils/xRender'

const AUTHOR = { id: 'u1', name: 'Petter', username: 'phareim' }

function maps(includes: any = {}) {
  return buildIncludeMaps({ users: [AUTHOR], ...includes })
}

describe('renderTweet', () => {
  it('renders a plain tweet with author line, paragraphs, and status link', () => {
    const item = renderTweet(
      {
        id: '100',
        author_id: 'u1',
        text: 'First line\n\nSecond para',
        created_at: '2026-07-01T10:00:00.000Z',
      },
      maps()
    )
    expect(item.source).toBe('x-bookmark')
    expect(item.externalId).toBe('100')
    expect(item.url).toBe('https://x.com/phareim/status/100')
    expect(item.author).toBe('@phareim')
    expect(item.content).toContain('<strong>@phareim</strong>')
    expect(item.content).toContain('· 2026-07-01')
    expect(item.content).toContain('<p>First line</p>')
    expect(item.content).toContain('<p>Second para</p>')
    expect(item.content).toContain('View on X →')
  })

  it('prefers note_tweet (long-form) text over the truncated text field', () => {
    const long = 'L'.repeat(300)
    const item = renderTweet(
      { id: '101', author_id: 'u1', text: 'short…', note_tweet: { text: long } },
      maps()
    )
    expect(item.content).toContain(long)
    expect(item.title.length).toBeLessThanOrEqual(90)
    expect(item.title.endsWith('…')).toBe(true)
  })

  it('escapes HTML in tweet text', () => {
    const item = renderTweet(
      { id: '102', author_id: 'u1', text: '<script>alert(1)</script> & fun' },
      maps()
    )
    expect(item.content).not.toContain('<script>')
    expect(item.content).toContain('&lt;script&gt;')
    expect(item.content).toContain('&amp; fun')
  })

  it('renders quoted and replied-to context blocks from includes', () => {
    const item = renderTweet(
      {
        id: '103',
        author_id: 'u1',
        text: 'agreeing loudly',
        referenced_tweets: [
          { type: 'replied_to', id: '90' },
          { type: 'quoted', id: '91' },
        ],
      },
      maps({
        users: [AUTHOR, { id: 'u2', username: 'other' }],
        tweets: [
          { id: '90', author_id: 'u2', text: 'original point' },
          { id: '91', author_id: 'u2', text: 'quoted wisdom' },
        ],
      })
    )
    expect(item.content).toContain('↳ Replying to @other')
    expect(item.content).toContain('original point')
    expect(item.content).toContain('❝ Quoting @other')
    expect(item.content).toContain('quoted wisdom')
  })

  it('renders attached media and uses the first image as lead image', () => {
    const item = renderTweet(
      {
        id: '104',
        author_id: 'u1',
        text: 'look at this',
        attachments: { media_keys: ['m1', 'm2'] },
      },
      maps({
        media: [
          { media_key: 'm1', type: 'photo', url: 'https://img.example/a.jpg', alt_text: 'a pic' },
          { media_key: 'm2', type: 'video', preview_image_url: 'https://img.example/b.jpg' },
        ],
      })
    )
    expect(item.imageUrl).toBe('https://img.example/a.jpg')
    expect(item.content).toContain('src="https://img.example/a.jpg"')
    expect(item.content).toContain('alt="a pic"')
    expect(item.content).toContain('src="https://img.example/b.jpg"')
  })

  it('keeps external links but drops media/status self-links, deduped', () => {
    const item = renderTweet(
      {
        id: '105',
        author_id: 'u1',
        text: 'links',
        entities: {
          urls: [
            { expanded_url: 'https://example.com/post', display_url: 'example.com/post' },
            { expanded_url: 'https://example.com/post', display_url: 'example.com/post' },
            { expanded_url: 'https://x.com/phareim/status/105/photo/1' },
            { expanded_url: 'https://x.com/someone/status/99' },
          ],
        },
      },
      maps()
    )
    const linkCount = (item.content.match(/example\.com\/post/g) || []).length
    expect(linkCount).toBe(2) // one <a href> + one display text — deduped to a single anchor
    expect(item.content).not.toContain('photo/1')
    expect(item.content).not.toContain('status/99')
  })

  it('falls back to "@handle on X" title for empty text', () => {
    const item = renderTweet({ id: '106', author_id: 'u1', text: '' }, maps())
    expect(item.title).toBe('@phareim on X')
    expect(item.summary).toBeUndefined()
  })

  describe('native X Articles (long-form)', () => {
    const articleTweet = {
      id: '200',
      author_id: 'u1',
      created_at: '2026-06-30T09:00:00.000Z',
      text: 'https://t.co/xyz',
      article: {
        title: 'On Reading Calmly',
        preview_text: 'A short preview.',
        plain_text: 'Introduction\nThis is a long paragraph that definitely ends with punctuation and runs on for a while.\nAnother long body paragraph with a full stop at the end.',
        cover_media: 'c1',
        media_entities: ['c1', 'm9'],
      },
    }
    const articleMaps = maps({
      media: [
        { media_key: 'c1', type: 'photo', url: 'https://img.example/cover.jpg' },
        { media_key: 'm9', type: 'photo', url: 'https://img.example/inline.jpg' },
      ],
    })

    it('renders title, cover, heading-detected body, and inline media', () => {
      const item = renderTweet(articleTweet, articleMaps)
      expect(item.title).toBe('On Reading Calmly')
      expect(item.summary).toBe('A short preview.')
      expect(item.imageUrl).toBe('https://img.example/cover.jpg')
      expect(item.content).toContain('<h2>Introduction</h2>')
      expect(item.content).toContain('<p>This is a long paragraph')
      // cover appears once as the cover, inline media separately
      expect(item.content).toContain('src="https://img.example/cover.jpg"')
      expect(item.content).toContain('src="https://img.example/inline.jpg"')
      expect(item.url).toBe('https://x.com/phareim/status/200')
    })

    it('treats short lines ending in punctuation as paragraphs, not headings', () => {
      const item = renderTweet(
        { ...articleTweet, article: { ...articleTweet.article, plain_text: 'Short but ends.', cover_media: undefined, media_entities: [] } },
        maps()
      )
      expect(item.content).toContain('<p>Short but ends.</p>')
      expect(item.content).not.toContain('<h2>')
    })
  })
})
