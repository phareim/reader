import { TextEncoder, TextDecoder } from 'node:util'
// jsdom's environment lacks the encoding API — provide Node's before the
// module under test runs.
;(globalThis as any).TextEncoder = (globalThis as any).TextEncoder ?? TextEncoder
;(globalThis as any).TextDecoder = (globalThis as any).TextDecoder ?? TextDecoder

import { charsetFromContentType, decodeFeedBody } from '../../server/utils/feedCharset'

describe('charsetFromContentType', () => {
  it('parses a plain charset', () => {
    expect(charsetFromContentType('application/xml; charset=utf-8')).toBe('utf-8')
  })

  it("survives The Oatmeal's malformed extra parameter", () => {
    expect(
      charsetFromContentType('application/xml; charset=ISO-8859-1; filename=feed.xml')
    ).toBe('ISO-8859-1')
  })

  it('strips quotes and ignores parameter order', () => {
    expect(charsetFromContentType('text/xml; boundary=x; charset="Windows-1252"')).toBe('Windows-1252')
  })

  it('defaults to utf-8 when absent, empty, or headerless', () => {
    expect(charsetFromContentType('application/rss+xml')).toBe('utf-8')
    expect(charsetFromContentType('application/xml; charset=')).toBe('utf-8')
    expect(charsetFromContentType(null)).toBe('utf-8')
    expect(charsetFromContentType(undefined)).toBe('utf-8')
  })
})

describe('decodeFeedBody', () => {
  const enc = (s: string) => new TextEncoder().encode(s).buffer as ArrayBuffer

  it('decodes latin-1 bytes under the declared charset', () => {
    // 'blåbær' in ISO-8859-1: å=0xE5, æ=0xE6
    const bytes = new Uint8Array([0x62, 0x6c, 0xe5, 0x62, 0xe6, 0x72]).buffer as ArrayBuffer
    expect(decodeFeedBody(bytes, 'text/xml; charset=ISO-8859-1; filename=feed.xml')).toBe('blåbær')
  })

  it('falls back to utf-8 for an unknown charset label', () => {
    expect(decodeFeedBody(enc('hello'), 'text/xml; charset=not-a-real-charset')).toBe('hello')
  })

  it('defaults to utf-8 without a header', () => {
    expect(decodeFeedBody(enc('héllo'), null)).toBe('héllo')
  })
})
