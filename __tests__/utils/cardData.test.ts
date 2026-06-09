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
