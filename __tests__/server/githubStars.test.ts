import { renderGithubStar } from '../../server/utils/githubStars'

const repo = (overrides: any = {}) => ({
  id: 123456,
  full_name: 'phareim/reader',
  html_url: 'https://github.com/phareim/reader',
  description: 'A calm, self-hosted RSS reader',
  language: 'TypeScript',
  stargazers_count: 42,
  homepage: 'https://reader.phareim.no',
  owner: { login: 'phareim', avatar_url: 'https://avatars.githubusercontent.com/u/1?v=4' },
  ...overrides,
})

describe('renderGithubStar', () => {
  it('renders a star+json entry: repo card with starred_at as publishedAt', () => {
    const item = renderGithubStar({ starred_at: '2026-07-18T09:30:00Z', repo: repo() })!
    expect(item.source).toBe('github-star')
    expect(item.externalId).toBe('123456')
    expect(item.url).toBe('https://github.com/phareim/reader')
    expect(item.title).toBe('phareim/reader')
    expect(item.author).toBe('phareim')
    expect(item.imageUrl).toBe('https://avatars.githubusercontent.com/u/1?v=4')
    expect(item.publishedAt).toBe('2026-07-18T09:30:00Z')
    expect(item.summary).toBe('A calm, self-hosted RSS reader')
    expect(item.content).toContain('<strong>phareim/reader</strong>')
    expect(item.content).toContain('<p>A calm, self-hosted RSS reader</p>')
    expect(item.content).toContain('TypeScript · ★ 42')
    expect(item.content).toContain('<a href="https://reader.phareim.no">reader.phareim.no →</a>')
    expect(item.content).toContain('<a href="https://github.com/phareim/reader">View on GitHub →</a>')
  })

  it('tolerates a plain repo object (no star Accept header): no publishedAt', () => {
    const item = renderGithubStar(repo())!
    expect(item.externalId).toBe('123456')
    expect(item.publishedAt).toBeUndefined()
  })

  it('escapes HTML in title and description', () => {
    const item = renderGithubStar({
      starred_at: '2026-07-18T09:30:00Z',
      repo: repo({ full_name: 'a/<b>', description: 'x < y & "z"' }),
    })!
    expect(item.content).toContain('<strong>a/&lt;b&gt;</strong>')
    expect(item.content).toContain('x &lt; y &amp; "z"')
    expect(item.content).not.toContain('<b>')
  })

  it('compacts large star counts and skips an empty meta line', () => {
    const big = renderGithubStar(repo({ stargazers_count: 24_500, language: null }))!
    expect(big.content).toContain('★ 25k')
    const bare = renderGithubStar(repo({ stargazers_count: null, language: null }))!
    expect(bare.content).not.toContain('★')
  })

  it('drops a non-http or self-referential homepage', () => {
    const bad = renderGithubStar(repo({ homepage: 'javascript:alert(1)' }))!
    expect(bad.content).not.toContain('javascript:')
    const self = renderGithubStar(repo({ homepage: 'https://github.com/phareim/reader' }))!
    expect(self.content.match(/<a href/g)!.length).toBe(1)
  })

  it('returns null for an entry without a usable repo', () => {
    expect(renderGithubStar(null)).toBeNull()
    expect(renderGithubStar({ starred_at: '2026-07-18T09:30:00Z', repo: {} })).toBeNull()
    expect(renderGithubStar({ id: 1, full_name: 'a/b' })).toBeNull() // no html_url
  })
})
