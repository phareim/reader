import { normalizeUrl } from '~/server/utils/urlNormalize'

describe('normalizeUrl', () => {
  it('drops the scheme so http and https collide', () => {
    expect(normalizeUrl('http://example.com/a')).toBe(normalizeUrl('https://example.com/a'))
  })

  it('lowercases and strips www from the host', () => {
    expect(normalizeUrl('https://WWW.Example.COM/Path')).toBe('example.com/Path')
  })

  it('keeps path case (paths are case-sensitive)', () => {
    expect(normalizeUrl('https://example.com/CamelCase')).toBe('example.com/CamelCase')
  })

  it('strips the fragment', () => {
    expect(normalizeUrl('https://example.com/a#section-2')).toBe('example.com/a')
  })

  it('strips trailing slash but keeps the root path', () => {
    expect(normalizeUrl('https://example.com/a/')).toBe('example.com/a')
    expect(normalizeUrl('https://example.com/')).toBe('example.com/')
    expect(normalizeUrl('https://example.com')).toBe('example.com/')
  })

  it('strips utm_* and known tracking params, keeps the rest', () => {
    expect(
      normalizeUrl('https://example.com/a?utm_source=x&utm_medium=social&id=7&fbclid=abc')
    ).toBe('example.com/a?id=7')
  })

  it('sorts surviving query params for a stable key', () => {
    expect(normalizeUrl('https://example.com/a?b=2&a=1')).toBe(
      normalizeUrl('https://example.com/a?a=1&b=2')
    )
  })

  it('folds twitter.com and mirrors into x.com and drops all X params', () => {
    const canonical = 'x.com/user/status/123'
    expect(normalizeUrl('https://twitter.com/user/status/123')).toBe(canonical)
    expect(normalizeUrl('https://mobile.twitter.com/user/status/123?s=46&t=zzz')).toBe(canonical)
    expect(normalizeUrl('https://x.com/user/status/123?s=20')).toBe(canonical)
  })

  it('keeps meaningful params on ordinary hosts (YouTube v/t are not tracking)', () => {
    expect(normalizeUrl('https://www.youtube.com/watch?v=abc&t=30s&si=SHARE')).toBe(
      'youtube.com/watch?t=30s&v=abc'
    )
  })

  it('keeps HN item ids distinct (the page lives in the id param)', () => {
    expect(normalizeUrl('https://news.ycombinator.com/item?id=1')).not.toBe(
      normalizeUrl('https://news.ycombinator.com/item?id=2')
    )
  })

  it('returns null for unparseable or non-http URLs', () => {
    expect(normalizeUrl('not a url')).toBeNull()
    expect(normalizeUrl('mailto:a@b.c')).toBeNull()
    expect(normalizeUrl('at://did:plc:xyz/app.bsky.feed.post/1')).toBeNull()
  })

  it('two different pages never collide', () => {
    expect(normalizeUrl('https://example.com/a?id=1')).not.toBe(
      normalizeUrl('https://example.com/a?id=2')
    )
    expect(normalizeUrl('https://a.example.com/p')).not.toBe(
      normalizeUrl('https://b.example.com/p')
    )
  })
})
