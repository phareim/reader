import { readingTimeMinutes, cardImageUrl, excerpt } from '~/utils/cardData'

describe('readingTimeMinutes', () => {
  it('returns null for missing or thin content (excerpt-only RSS)', () => {
    expect(readingTimeMinutes(null)).toBeNull()
    expect(readingTimeMinutes(undefined)).toBeNull()
    expect(readingTimeMinutes('<p>' + 'word '.repeat(100) + '</p>')).toBeNull()
  })

  it('estimates minutes at 220 wpm on stripped text', () => {
    const html = '<article><p>' + 'word '.repeat(660) + '</p></article>'
    expect(readingTimeMinutes(html)).toBe(3)
  })

  it('rounds up', () => {
    const html = '<p>' + 'word '.repeat(230) + '</p>'
    expect(readingTimeMinutes(html)).toBe(2)
  })
})

describe('cardImageUrl', () => {
  it('passes through a real article image', () => {
    expect(cardImageUrl('https://cdn.example.com/lead.jpg')).toBe('https://cdn.example.com/lead.jpg')
  })

  it.each([
    'https://images.unsplash.com/photo-123?w=600',
    'https://source.unsplash.com/random/800x600',
  ])('filters legacy Unsplash filler: %s', (url) => {
    expect(cardImageUrl(url)).toBeNull()
  })

  it('handles null/undefined', () => {
    expect(cardImageUrl(null)).toBeNull()
    expect(cardImageUrl(undefined)).toBeNull()
  })

  it('repairs legacy entity-encoded ampersands (broken query params serve the master asset)', () => {
    expect(cardImageUrl('https://cdn.example.com/pic.jpg?quality=90&#038;strip=all&#038;w=1200'))
      .toBe('https://cdn.example.com/pic.jpg?quality=90&strip=all&w=1200')
    expect(cardImageUrl('https://cdn.example.com/pic.jpg?w=800&amp;h=600'))
      .toBe('https://cdn.example.com/pic.jpg?w=800&h=600')
    expect(cardImageUrl('https://cdn.example.com/pic.jpg?w=800&#x26;h=600'))
      .toBe('https://cdn.example.com/pic.jpg?w=800&h=600')
  })

  it('caps width on WordPress uploads without a width param (masters crash iOS)', () => {
    expect(cardImageUrl('https://platform.theverge.com/wp-content/uploads/sites/2/2026/07/pic.jpg?quality=90&strip=all'))
      .toBe('https://platform.theverge.com/wp-content/uploads/sites/2/2026/07/pic.jpg?quality=90&strip=all&w=1200')
    expect(cardImageUrl('https://example.com/wp-content/uploads/2026/07/bare.jpg'))
      .toBe('https://example.com/wp-content/uploads/2026/07/bare.jpg?w=1200')
  })

  it('caps width after entity repair (the stored Verge shape)', () => {
    expect(cardImageUrl('https://platform.theverge.com/wp-content/uploads/sites/2/2026/07/pic.jpg?quality=90&#038;strip=all'))
      .toBe('https://platform.theverge.com/wp-content/uploads/sites/2/2026/07/pic.jpg?quality=90&strip=all&w=1200')
  })

  it('leaves WordPress URLs that already carry a width param alone', () => {
    expect(cardImageUrl('https://bigthink.com/wp-content/uploads/2026/07/pic.jpg?quality=85&w=640'))
      .toBe('https://bigthink.com/wp-content/uploads/2026/07/pic.jpg?quality=85&w=640')
    expect(cardImageUrl('https://example.com/wp-content/uploads/pic.jpg?width=900'))
      .toBe('https://example.com/wp-content/uploads/pic.jpg?width=900')
  })

  it('caps any host whose path is a WP upload (proxied WP CDNs included)', () => {
    expect(cardImageUrl('https://static0.polygonimages.com/wordpress/wp-content/uploads/2026/07/shenmue-3.jpg'))
      .toBe('https://static0.polygonimages.com/wordpress/wp-content/uploads/2026/07/shenmue-3.jpg?w=1200')
  })

  it('never touches non-WordPress URLs', () => {
    expect(cardImageUrl('https://media.newyorker.com/cartoons/abc/master/pass/A62099.jpg'))
      .toBe('https://media.newyorker.com/cartoons/abc/master/pass/A62099.jpg')
  })
})

describe('excerpt', () => {
  it('strips tags and truncates on a word boundary with an ellipsis', () => {
    const html = '<p>Alpha <b>beta</b> gamma delta epsilon zeta</p>'
    expect(excerpt(html, 20)).toBe('Alpha beta gamma…')
  })

  it('returns short text untouched', () => {
    expect(excerpt('<p>Short.</p>', 200)).toBe('Short.')
  })

  it('returns empty string for nothing', () => {
    expect(excerpt(null, 100)).toBe('')
  })
})
