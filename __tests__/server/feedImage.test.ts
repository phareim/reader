import { extractImageUrl } from '~/server/utils/feedImage'

describe('extractImageUrl', () => {
  it('reads media:thumbnail attributes in fast-xml-parser shape (BBC)', () => {
    const item = {
      mediaThumbnail: {
        '@_width': '240',
        '@_height': '135',
        '@_url': 'https://ichef.bbci.co.uk/ace/standard/240/lead.jpg'
      }
    }
    expect(extractImageUrl(item)).toBe('https://ichef.bbci.co.uk/ace/standard/240/lead.jpg')
  })

  it('reads media:content marked as an image', () => {
    const item = {
      mediaContent: {
        '@_url': 'https://example.com/lead.jpg',
        '@_type': 'image/jpeg'
      }
    }
    expect(extractImageUrl(item)).toBe('https://example.com/lead.jpg')
  })

  it('accepts media:content with only a url (no type/medium)', () => {
    const item = { mediaContent: { '@_url': 'https://example.com/lead.jpg' } }
    expect(extractImageUrl(item)).toBe('https://example.com/lead.jpg')
  })

  it('skips non-image media:content in a list and picks the image', () => {
    const item = {
      mediaContent: [
        { '@_url': 'https://example.com/clip.mp4', '@_medium': 'video' },
        { '@_url': 'https://example.com/lead.jpg', '@_medium': 'image' }
      ]
    }
    expect(extractImageUrl(item)).toBe('https://example.com/lead.jpg')
  })

  it('finds the thumbnail inside media:group (YouTube)', () => {
    const item = {
      mediaGroup: {
        'media:content': {
          '@_url': 'https://www.youtube.com/v/abc123',
          '@_type': 'application/x-shockwave-flash'
        },
        'media:thumbnail': {
          '@_url': 'https://i.ytimg.com/vi/abc123/hqdefault.jpg',
          '@_width': '480',
          '@_height': '360'
        }
      }
    }
    expect(extractImageUrl(item)).toBe('https://i.ytimg.com/vi/abc123/hqdefault.jpg')
  })

  it('uses an image enclosure', () => {
    const item = {
      enclosure: { '@_url': 'https://example.com/photo.png', '@_type': 'image/png', '@_length': '1234' }
    }
    expect(extractImageUrl(item)).toBe('https://example.com/photo.png')
  })

  it('ignores a non-image enclosure (podcast audio)', () => {
    const item = {
      enclosure: { '@_url': 'https://example.com/ep1.mp3', '@_type': 'audio/mpeg' }
    }
    expect(extractImageUrl(item)).toBeUndefined()
  })

  it('reads itunes:image href', () => {
    const item = { itunesImage: { '@_href': 'https://example.com/cover.jpg' } }
    expect(extractImageUrl(item)).toBe('https://example.com/cover.jpg')
  })

  it('falls back to the first <img> in the HTML content', () => {
    const html = '<p>Intro</p><img src="https://example.com/inline.jpg" alt=""><p>More</p>'
    expect(extractImageUrl({}, html)).toBe('https://example.com/inline.jpg')
  })

  it('prefers media metadata over the content <img>', () => {
    const item = { mediaThumbnail: { '@_url': 'https://example.com/thumb.jpg' } }
    const html = '<img src="https://example.com/inline.jpg">'
    expect(extractImageUrl(item, html)).toBe('https://example.com/thumb.jpg')
  })

  it('returns undefined when nothing is found', () => {
    expect(extractImageUrl({})).toBeUndefined()
    expect(extractImageUrl({}, '<p>no images here</p>')).toBeUndefined()
  })
})
