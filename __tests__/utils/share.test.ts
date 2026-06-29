import { xShareUrl, threadsShareUrl } from '~/utils/share'

const LINK = 'https://example.com/a?b=1&c=2'
const TITLE = 'Hello & welcome'

describe('xShareUrl', () => {
  it('puts the title in text and the link in url, both encoded', () => {
    const u = new URL(xShareUrl(TITLE, LINK))
    expect(u.origin + u.pathname).toBe('https://x.com/intent/tweet')
    expect(u.searchParams.get('text')).toBe(TITLE)
    expect(u.searchParams.get('url')).toBe(LINK)
  })

  it('omits text when the title is empty', () => {
    const u = new URL(xShareUrl('', LINK))
    expect(u.searchParams.has('text')).toBe(false)
    expect(u.searchParams.get('url')).toBe(LINK)
  })

  it('tolerates a null/undefined title', () => {
    const u = new URL(xShareUrl(null, LINK))
    expect(u.searchParams.has('text')).toBe(false)
    expect(u.searchParams.get('url')).toBe(LINK)
  })
})

describe('threadsShareUrl', () => {
  it('puts only the link in the text param (Threads renders it as a card)', () => {
    const u = new URL(threadsShareUrl(LINK))
    expect(u.origin + u.pathname).toBe('https://www.threads.net/intent/post')
    expect(u.searchParams.get('text')).toBe(LINK)
  })
})
