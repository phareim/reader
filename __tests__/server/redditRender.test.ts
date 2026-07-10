import { renderRedditChild } from '../../server/utils/redditRender'

describe('renderRedditChild', () => {
  const post = (data: any) => ({ kind: 't3', data })
  const comment = (data: any) => ({ kind: 't1', data })

  it('renders a self post with title, subreddit line, and selftext HTML', () => {
    const item = renderRedditChild(
      post({
        name: 't3_abc',
        title: 'A question about calm readers',
        subreddit_name_prefixed: 'r/rss',
        author: 'phareim',
        created_utc: 1751500800,
        is_self: true,
        selftext: 'Body text here',
        selftext_html: '<div class="md"><p>Body text here</p></div>',
        permalink: '/r/rss/comments/abc/a_question/',
      })
    )!
    expect(item.source).toBe('reddit')
    expect(item.externalId).toBe('t3_abc')
    expect(item.url).toBe('https://www.reddit.com/r/rss/comments/abc/a_question/')
    expect(item.author).toBe('u/phareim')
    expect(item.title).toBe('A question about calm readers')
    expect(item.content).toContain('<strong>A question about calm readers</strong>')
    expect(item.content).toContain('r/rss · u/phareim · 2025-07-03')
    expect(item.content).toContain('<p>Body text here</p>')
    expect(item.content).toContain('View on Reddit →')
    expect(item.summary).toBe('Body text here')
  })

  it('renders a link post with external link and preview image', () => {
    const item = renderRedditChild(
      post({
        name: 't3_link',
        title: 'Interesting article',
        subreddit: 'programming',
        author: 'someone',
        is_self: false,
        url: 'https://example.com/article',
        domain: 'example.com',
        preview: { images: [{ source: { url: 'https://preview.redd.it/img.jpg' } }] },
        permalink: '/r/programming/comments/link/interesting/',
      })
    )!
    expect(item.imageUrl).toBe('https://preview.redd.it/img.jpg')
    expect(item.content).toContain('src="https://preview.redd.it/img.jpg"')
    expect(item.content).toContain('<a href="https://example.com/article">example.com →</a>')
    expect(item.content).toContain('r/programming')
  })

  it('does not add an external-link line for direct image posts', () => {
    const item = renderRedditChild(
      post({
        name: 't3_img',
        title: 'A picture',
        subreddit: 'pics',
        is_self: false,
        url: 'https://i.redd.it/direct.jpg',
        permalink: '/r/pics/comments/img/a_picture/',
      })
    )!
    expect(item.imageUrl).toBe('https://i.redd.it/direct.jpg')
    expect(item.content).not.toContain('i.redd.it →')
  })

  it('escapes HTML in titles', () => {
    const item = renderRedditChild(
      post({ name: 't3_esc', title: '<b>bold</b> & such', permalink: '/r/x/comments/esc/t/' })
    )!
    expect(item.content).toContain('&lt;b&gt;bold&lt;/b&gt; &amp; such')
  })

  it('renders a saved comment with thread context and body_html', () => {
    const item = renderRedditChild(
      comment({
        name: 't1_xyz',
        subreddit_name_prefixed: 'r/askscience',
        author: 'expert',
        created_utc: 1751500800,
        link_title: 'Why is the sky blue?',
        body: 'Rayleigh scattering explains it.',
        body_html: '<div class="md"><p>Rayleigh scattering explains it.</p></div>',
        permalink: '/r/askscience/comments/q/why/answer/',
      })
    )!
    expect(item.externalId).toBe('t1_xyz')
    expect(item.title).toBe('Comment on Why is the sky blue?')
    expect(item.content).toContain('Comment on “Why is the sky blue?”')
    expect(item.content).toContain('<p>Rayleigh scattering explains it.</p>')
    expect(item.url).toBe('https://www.reddit.com/r/askscience/comments/q/why/answer/')
    expect(item.summary).toBe('Rayleigh scattering explains it.')
  })

  it('returns null for unrenderable children', () => {
    expect(renderRedditChild(null)).toBeNull()
    expect(renderRedditChild({ kind: 't3', data: {} })).toBeNull() // no name
    expect(renderRedditChild(post({ name: 't3_np' }))).toBeNull() // no permalink
    expect(renderRedditChild({ kind: 't5', data: { name: 't5_sub' } })).toBeNull() // subreddit
  })
})
