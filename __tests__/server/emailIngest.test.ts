import { stripForwardPrefixes, firstHttpLink, emailGuid } from '~/server/utils/emailIngest'
import { senderAuthOk } from '~/email-worker/src/authResults'

describe('stripForwardPrefixes', () => {
  it('strips single and chained forward/reply prefixes, incl. Norwegian', () => {
    expect(stripForwardPrefixes('Fwd: Money Stuff: The Index Fund Did It')).toBe(
      'Money Stuff: The Index Fund Did It'
    )
    expect(stripForwardPrefixes('Fw: Re: Fwd: hello')).toBe('hello')
    expect(stripForwardPrefixes('SV: VS: statusrapport')).toBe('statusrapport')
  })

  it('keeps prefixes mid-title (only leading chains strip)', () => {
    expect(stripForwardPrefixes('The problem with Re: everything')).toBe(
      'The problem with Re: everything'
    )
  })

  it('falls back for empty subjects', () => {
    expect(stripForwardPrefixes('')).toBe('Untitled email')
    expect(stripForwardPrefixes(null)).toBe('Untitled email')
    expect(stripForwardPrefixes('Fwd: ')).toBe('Untitled email')
  })
})

describe('firstHttpLink', () => {
  it('prefers the first href in the HTML part', () => {
    const html = '<p>Hi</p><a href="https://letter.example/issue/42?x=1">View in browser</a> <a href="https://other.example/">o</a>'
    expect(firstHttpLink(html, 'https://text.example/')).toBe('https://letter.example/issue/42?x=1')
  })

  it('falls back to a bare URL in text, shedding sentence punctuation', () => {
    expect(firstHttpLink(null, 'read this: https://a.example/post. thanks')).toBe(
      'https://a.example/post'
    )
  })

  it('stops bare URLs at whitespace and closing brackets', () => {
    expect(firstHttpLink(null, '(see https://a.example/p)')).toBe('https://a.example/p')
    expect(firstHttpLink(null, 'x https://a.example/p y')).toBe('https://a.example/p')
  })

  it('ignores non-http schemes and returns null when linkless', () => {
    expect(firstHttpLink('<a href="mailto:x@y.z">m</a>', 'no links here')).toBeNull()
    expect(firstHttpLink(null, null)).toBeNull()
  })
})

describe('emailGuid', () => {
  it('sheds angle brackets and whitespace', () => {
    expect(emailGuid(' <abc123@mail.example> ')).toBe('email:abc123@mail.example')
  })

  it('is stable (idempotent double-forwards)', () => {
    expect(emailGuid('<x@y>')).toBe(emailGuid('<x@y>'))
  })

  it('compresses over-long ids inside the guid budget, still deterministic', () => {
    const long = 'a'.repeat(400) + '@mail.example'
    const g = emailGuid(long)
    expect(g.length).toBeLessThanOrEqual(180)
    expect(g).toBe(emailGuid(long))
    // a different long id must not collide on the visible prefix alone
    expect(g).not.toBe(emailGuid(long.replace(/@mail/, '@other')))
  })
})

describe('senderAuthOk (email-worker alignment check)', () => {
  const CF = (s: string) => `i=1; mx.cloudflare.net; ${s}`

  it('passes on aligned DKIM', () => {
    expect(senderAuthOk(CF('dkim=pass header.d=gmail.com; spf=none'), 'gmail.com')).toBe(true)
  })

  it('passes on aligned SPF (with and without local part)', () => {
    expect(senderAuthOk(CF('spf=pass smtp.mailfrom=gmail.com'), 'gmail.com')).toBe(true)
    expect(senderAuthOk(CF('spf=pass smtp.mailfrom=user@gmail.com'), 'gmail.com')).toBe(true)
  })

  it('passes on DMARC pass regardless of mechanism domains', () => {
    expect(senderAuthOk(CF('dkim=pass header.d=bulk.example; dmarc=pass action=none header.from=gmail.com'), 'gmail.com')).toBe(true)
  })

  it('accepts relaxed (org-domain) alignment', () => {
    expect(senderAuthOk(CF('dkim=pass header.d=mail.gmail.com'), 'gmail.com')).toBe(true)
    expect(senderAuthOk(CF('spf=pass smtp.mailfrom=bounce.corp.example'), 'corp.example')).toBe(true)
  })

  it('fails when every pass belongs to an unrelated domain', () => {
    expect(senderAuthOk(CF('dkim=pass header.d=evil.example; spf=pass smtp.mailfrom=evil.example; dmarc=fail'), 'gmail.com')).toBe(false)
    // suffix trickery: notgmail.com must not align with gmail.com
    expect(senderAuthOk(CF('dkim=pass header.d=notgmail.com'), 'gmail.com')).toBe(false)
  })

  it('fails when nothing passed', () => {
    expect(senderAuthOk(CF('spf=fail smtp.mailfrom=gmail.com; dkim=fail header.d=gmail.com'), 'gmail.com')).toBe(false)
  })

  it('allows a missing header (Cloudflare edge gate already ran)', () => {
    expect(senderAuthOk(null, 'gmail.com')).toBe(true)
    expect(senderAuthOk('', 'gmail.com')).toBe(true)
  })
})
