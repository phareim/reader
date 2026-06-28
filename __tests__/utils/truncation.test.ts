import { looksTruncated } from '~/utils/truncation'

// A realistic full-length body (well over the tail window) for negative cases.
const longBody =
  '<p>' + 'This is a complete article with several real paragraphs. '.repeat(40) + '</p>'

describe('looksTruncated', () => {
  it('detects the Ars Technica "Read full article" footer', () => {
    const html =
      '<p>Apple and Audi alumni have made a luxe EV based on the moon buggy.</p>' +
      '<p><a href="https://arstechnica.com/cars/2026/06/luxe-ev/">Read full article</a></p>'
    expect(looksTruncated(html)).toBe(true)
  })

  it('detects "Continue reading" footers', () => {
    const html = longBody + '<p><a href="https://example.com/post">Continue reading →</a></p>'
    expect(looksTruncated(html)).toBe(true)
  })

  it('detects "Read the rest of this entry"', () => {
    const html = '<p>Snippet.</p><a href="https://example.com/x">Read the rest of this entry »</a>'
    expect(looksTruncated(html)).toBe(true)
  })

  it('detects a trailing [...] bracket marker', () => {
    expect(looksTruncated('<p>An excerpt that trails off here [&hellip;]</p>')).toBe(true)
    expect(looksTruncated('<p>An excerpt that trails off here [...]</p>')).toBe(true)
    expect(looksTruncated('<p>An excerpt that trails off [Read more]</p>')).toBe(true)
  })

  it('detects a short trailing anchor pointing at the article URL', () => {
    const url = 'https://example.com/some-story'
    const html = longBody + `<p><a href="${url}?utm=rss">Les hele saken</a></p>`
    expect(looksTruncated(html, url)).toBe(true)
    // Without the URL hint, the foreign-language phrase isn't recognised.
    expect(looksTruncated(html)).toBe(false)
  })

  it('ignores a long body with no footer', () => {
    expect(looksTruncated(longBody)).toBe(false)
  })

  it('ignores an inline "read more" link buried mid-body', () => {
    const html =
      '<p>Intro. <a href="https://example.com/a">Read more about widgets</a> here.</p>' + longBody
    expect(looksTruncated(html)).toBe(false)
  })

  it('ignores a normal trailing link whose text is not a read-more phrase', () => {
    const html = longBody + '<p>Source: <a href="https://example.com/src">Apple Newsroom</a></p>'
    expect(looksTruncated(html)).toBe(false)
  })

  it('does not match a non-canonical short trailing anchor without the URL hint', () => {
    const html = longBody + '<p><a href="https://example.com/other">Home</a></p>'
    expect(looksTruncated(html, 'https://example.com/some-story')).toBe(false)
  })

  it('handles empty / nullish input', () => {
    expect(looksTruncated('')).toBe(false)
    expect(looksTruncated(null)).toBe(false)
    expect(looksTruncated(undefined)).toBe(false)
  })
})
