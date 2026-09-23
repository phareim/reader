import { directFaviconUrl, largestSrc, proxiedImage, proxyContentImages } from '~/utils/imageProxy'

describe('proxiedImage', () => {
  it('wraps remote urls with the width', () => {
    expect(proxiedImage('https://a.example/x.png?a=1&b=2', 480))
      .toBe('/api/img?w=480&u=https%3A%2F%2Fa.example%2Fx.png%3Fa%3D1%26b%3D2')
  })
  it('leaves data:, relative and empty sources alone', () => {
    expect(proxiedImage('data:image/png;base64,AAA', 480)).toBe('data:image/png;base64,AAA')
    expect(proxiedImage('/favicon.png', 480)).toBe('/favicon.png')
    expect(proxiedImage(null, 480)).toBeNull()
  })
})

describe('largestSrc', () => {
  it('picks the widest w descriptor', () => {
    expect(largestSrc('s.jpg', 'a.jpg 320w, b.jpg 1600w, c.jpg 800w')).toBe('b.jpg')
  })
  it('picks the highest density', () => {
    expect(largestSrc('s.jpg', 'a.jpg 1x, b.jpg 2x')).toBe('b.jpg')
  })
  it('falls back to src without srcset', () => {
    expect(largestSrc('s.jpg', null)).toBe('s.jpg')
  })
})

describe('proxyContentImages', () => {
  it('rewrites every img and marks it lazy', () => {
    const div = document.createElement('div')
    div.innerHTML = '<img src="https://a.example/1.png"><p><img src="data:image/gif;base64,R0"></p>'
    proxyContentImages(div)
    const imgs = div.querySelectorAll('img')
    expect(imgs[0].getAttribute('src')).toBe('/api/img?w=1080&u=https%3A%2F%2Fa.example%2F1.png')
    expect(imgs[1].getAttribute('src')).toBe('data:image/gif;base64,R0')
    imgs.forEach((img) => expect(img.getAttribute('loading')).toBe('lazy'))
  })
})

describe('directFaviconUrl', () => {
  it('skips the S2 redirect hop', () => {
    expect(directFaviconUrl('https://www.google.com/s2/favicons?domain=thezvi.substack.com&sz=32'))
      .toBe('https://t1.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=http://thezvi.substack.com&size=32')
  })
  it('leaves other favicon urls alone', () => {
    expect(directFaviconUrl('https://example.com/favicon.ico')).toBe('https://example.com/favicon.ico')
  })
})
