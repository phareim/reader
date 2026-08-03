import { resolveContentUrls, resolveUrl, resolveSrcset } from '~/server/utils/resolveContentUrls'

describe('resolveUrl', () => {
  it('resolves a root-relative URL against the base', () => {
    expect(resolveUrl('/assets/2026/trust-me.jpg', 'https://bjorg.bjornroche.com/management/secret/'))
      .toBe('https://bjorg.bjornroche.com/assets/2026/trust-me.jpg')
  })

  it('leaves an already-absolute URL untouched', () => {
    expect(resolveUrl('https://cdn.example.com/img.jpg', 'https://example.com/post/'))
      .toBe('https://cdn.example.com/img.jpg')
  })

  it('resolves a document-relative URL against the base', () => {
    expect(resolveUrl('../images/foo.jpg', 'https://example.com/2026/01/post/'))
      .toBe('https://example.com/2026/01/images/foo.jpg')
  })

  it('returns empty string for a missing value', () => {
    expect(resolveUrl(null, 'https://example.com')).toBe('')
    expect(resolveUrl(undefined, 'https://example.com')).toBe('')
  })
})

describe('resolveSrcset', () => {
  it('resolves every candidate URL, keeping descriptors', () => {
    const input = '/img-480.jpg 480w, /img-800.jpg 800w'
    expect(resolveSrcset(input, 'https://example.com/post/'))
      .toBe('https://example.com/img-480.jpg 480w, https://example.com/img-800.jpg 800w')
  })
})

describe('resolveContentUrls', () => {
  const base = 'https://bjorg.bjornroche.com/management/secret-to-getting-promoted/'

  it('rewrites a root-relative img src to absolute (the bjorg.bjornroche.com bug)', () => {
    const html = '<img src="/assets/2026/trust-me.jpg" alt="Meme">'
    const result = resolveContentUrls(html, base)
    expect(result).toContain('src="https://bjorg.bjornroche.com/assets/2026/trust-me.jpg"')
  })

  it('rewrites relative a[href] too', () => {
    const html = '<p><a href="/other-post/">read more</a></p>'
    const result = resolveContentUrls(html, base)
    expect(result).toContain('href="https://bjorg.bjornroche.com/other-post/"')
  })

  it('rewrites relative srcset candidates', () => {
    const html = '<img src="/a.jpg" srcset="/a-480.jpg 480w, /a-800.jpg 800w">'
    const result = resolveContentUrls(html, base)
    expect(result).toContain('https://bjorg.bjornroche.com/a-480.jpg 480w')
    expect(result).toContain('https://bjorg.bjornroche.com/a-800.jpg 800w')
  })

  it('leaves already-absolute URLs untouched', () => {
    const html = '<img src="https://cdn.example.com/img.jpg">'
    expect(resolveContentUrls(html, base)).toContain('src="https://cdn.example.com/img.jpg"')
  })

  it('passes through empty input', () => {
    expect(resolveContentUrls('', base)).toBe('')
  })
})
