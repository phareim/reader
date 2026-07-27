import { processArticleContent } from '~/utils/processArticleContent'

describe('processArticleContent', () => {
  it('returns null for empty content', () => {
    expect(processArticleContent(null)).toBeNull()
    expect(processArticleContent(undefined)).toBeNull()
    expect(processArticleContent('')).toBeNull()
  })

  it('paragraphizes legacy plain-text content', () => {
    const result = processArticleContent('First paragraph.\n\nSecond paragraph.')
    expect(result).toContain('<p>First paragraph.</p>')
    expect(result).toContain('<p>Second paragraph.</p>')
  })

  it('passes rich HTML through intact', () => {
    const html = '<h2>Head</h2><p>Body with <em>emphasis</em> and <strong>bold</strong>.</p><blockquote><p>Quote</p></blockquote>'
    const result = processArticleContent(html)!
    expect(result).toContain('<h2>Head</h2>')
    expect(result).toContain('<em>emphasis</em>')
    expect(result).toContain('<blockquote>')
  })

  it('forces target=_blank rel=noopener on links', () => {
    const result = processArticleContent('<p><a href="https://example.com">x</a></p>')!
    expect(result).toContain('target="_blank"')
    expect(result).toContain('rel="noopener noreferrer"')
  })

  it('keeps the extended Readability tags', () => {
    const html = '<p>a<sup>1</sup> b<sub>2</sub></p><hr><dl><dt>Term</dt><dd>Def</dd></dl>'
    const result = processArticleContent(html)!
    expect(result).toContain('<sup>1</sup>')
    expect(result).toContain('<sub>2</sub>')
    expect(result).toContain('<hr>')
    expect(result).toContain('<dt>Term</dt>')
  })

  it('keeps srcset/sizes/loading on images', () => {
    const html = '<img src="https://a.example/x.png" srcset="https://a.example/x-2x.png 2x" sizes="100vw" loading="lazy" alt="x">'
    const result = processArticleContent(html)!
    expect(result).toContain('srcset=')
    expect(result).toContain('sizes="100vw"')
    expect(result).toContain('loading="lazy"')
  })

  it('strips scripts and event handlers', () => {
    const result = processArticleContent('<p onclick="evil()">x</p><script>evil()</script>')!
    expect(result).not.toContain('onclick')
    expect(result).not.toContain('<script>')
    expect(result).toContain('x')
  })

  it('keeps <video> playback markup (X video in the Found feed)', () => {
    const html =
      '<p><video controls playsinline preload="metadata" poster="https://a.example/p.jpg" src="https://a.example/v.mp4"></video></p>'
    const result = processArticleContent(html)!
    expect(result).toContain('<video')
    expect(result).toContain('controls')
    expect(result).toContain('playsinline')
    expect(result).toContain('preload="metadata"')
    expect(result).toContain('poster="https://a.example/p.jpg"')
    expect(result).toContain('src="https://a.example/v.mp4"')
  })

  it('keeps <source> inside a video but drops autoplay', () => {
    const html =
      '<video controls autoplay><source src="https://a.example/v.mp4" type="video/mp4"></video>'
    const result = processArticleContent(html)!
    expect(result).toContain('<source')
    expect(result).toContain('type="video/mp4"')
    expect(result).toContain('controls')
    expect(result).not.toContain('autoplay')
  })

  it('still strips iframes — the allowlist is video-only, not embed-wide', () => {
    const result = processArticleContent(
      '<p>before</p><iframe src="https://evil.example/frame"></iframe><p>after</p>'
    )!
    expect(result).not.toContain('<iframe')
    expect(result).not.toContain('evil.example')
    expect(result).toContain('before')
    expect(result).toContain('after')
  })

  it('strips event handlers on video elements', () => {
    const result = processArticleContent(
      '<video controls onerror="evil()" src="https://a.example/v.mp4"></video>'
    )!
    expect(result).not.toContain('onerror')
    expect(result).toContain('<video')
  })
})
