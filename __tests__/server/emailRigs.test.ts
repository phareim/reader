import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { rigForEmail, applyEmailRig } from '~/server/utils/emailRigs'
import { tldrRig } from '~/server/utils/emailRigs/tldr'
import { unwrapCl0, unwrapHrefs, stripTrackingPixels } from '~/server/utils/emailRigs/unwrap'

// The first real newsletter through the reader@ pipe (Article #449003).
const tldrHtml = readFileSync(join(__dirname, '../fixtures/tldr-2026-07-28.html'), 'utf-8')

describe('unwrapCl0', () => {
  it('decodes the percent-encoded target out of a CL0 wrapper', () => {
    expect(
      unwrapCl0('https://tracking.tldrnewsletter.com/CL0/https:%2F%2Ftldr.tech%2Fsignup%3Futm_source=tldr/1/0100019f-abc/sig=452')
    ).toBe('https://tldr.tech/signup?utm_source=tldr')
  })

  it('leaves non-CL0 and malformed URLs untouched', () => {
    expect(unwrapCl0('https://example.com/article')).toBe('https://example.com/article')
    expect(unwrapCl0('https://t.example/CL0/not-a-url/1/x')).toBe('https://t.example/CL0/not-a-url/1/x')
    expect(unwrapCl0('https://t.example/CL0/https:%2/1/x')).toBe('https://t.example/CL0/https:%2/1/x')
  })
})

describe('unwrapHrefs', () => {
  it('rewrites every wrapped href and keeps the rest byte-identical', () => {
    const html = '<a href="https://t.example/CL0/https:%2F%2Freal.example%2Fa/1/tok">a</a> <a href="https://plain.example/">b</a>'
    expect(unwrapHrefs(html, unwrapCl0)).toBe(
      '<a href="https://real.example/a">a</a> <a href="https://plain.example/">b</a>'
    )
  })
})

describe('stripTrackingPixels', () => {
  it('drops declared 1x1/2x2 images, keeps real imagery', () => {
    const html = '<img src="https://o.example/px" width="1" height="1"><img src="https://img.example/hero.jpg" width="600">'
    expect(stripTrackingPixels(html)).toBe('<img src="https://img.example/hero.jpg" width="600">')
  })

  it('never touches images without tiny declared dimensions', () => {
    const html = '<img src="https://img.example/a.png"><img src="b.png" width="120">'
    expect(stripTrackingPixels(html)).toBe(html)
  })
})

describe('tldr rig on the real 2026-07-28 issue', () => {
  it('is matched by link hosts (the sender is the forwarder, not TLDR)', () => {
    expect(rigForEmail(tldrHtml)).toBe(tldrRig)
    expect(rigForEmail('<a href="https://example.com/">x</a>')).toBeNull()
    expect(rigForEmail(null)).toBeNull()
  })

  it('picks the unwrapped View Online link as card URL, not the signup link', () => {
    const { url } = applyEmailRig(tldrHtml)
    expect(url).toMatch(/^https:\/\/a\.tldrnewsletter\.com\/web-version\?/)
  })

  it('unwraps all CL0 links and strips the open tracker from the body', () => {
    const { html } = applyEmailRig(tldrHtml)
    expect(html).not.toBeNull()
    expect(html!).not.toContain('/CL0/')
    // Spot-check a story link survived unwrapping into its real target.
    expect(html!).toContain('href="https://www.pcmag.com/news/amazon-plans-to-launch-5000-new-satellites')
  })

  it('credits TLDR as author', () => {
    expect(applyEmailRig(tldrHtml).author).toBe('TLDR')
  })
})

describe('applyEmailRig fail-soft contract', () => {
  it('returns the null shape for rig-less or empty emails', () => {
    expect(applyEmailRig('<p>plain email, no links</p>')).toEqual({
      rigId: null, url: null, author: null, html: null
    })
    expect(applyEmailRig(undefined).rigId).toBeNull()
  })
})
