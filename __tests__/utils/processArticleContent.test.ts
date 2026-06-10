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
})
