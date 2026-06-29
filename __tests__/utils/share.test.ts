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
  it('folds title + url into a single text param', () => {
    const u = new URL(threadsShareUrl(TITLE, LINK))
    expect(u.origin + u.pathname).toBe('https://www.threads.net/intent/post')
    expect(u.searchParams.get('text')).toBe(`${TITLE} ${LINK}`)
  })

  it('uses just the url when the title is empty', () => {
    const u = new URL(threadsShareUrl('  ', LINK))
    expect(u.searchParams.get('text')).toBe(LINK)
  })
})
