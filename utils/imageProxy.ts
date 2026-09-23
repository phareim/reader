/**
 * imageProxy.ts — route remote article images through /api/img
 * (server/api/img.get.ts), which re-encodes anything heavy to a width-capped
 * WebP. Feeds routinely ship multi-megabyte PNG masters (a 1.66 MB Hugging
 * Face PNG comes back as a 25 KB WebP), and on a phone those bytes were the
 * bulk of every deck load and article open.
 */

/**
 * The only widths the proxy accepts. Each (image, width) pair counts as one
 * unique Cloudflare Images transformation, so keep this set small.
 */
export const IMAGE_WIDTH = {
  /** Deck card, article body: ~360 css px at 3x on a phone, prose column on desktop. */
  full: 1080,
  /** Grid mini card thumbnail. */
  thumb: 480,
} as const

export const PROXY_WIDTHS: readonly number[] = Object.values(IMAGE_WIDTH)

export function proxiedImage(url: string | null | undefined, width: number): string | null {
  if (!url) return null
  if (!/^https?:\/\//i.test(url)) return url // data:, blob:, same-origin paths
  return `/api/img?w=${width}&u=${encodeURIComponent(url)}`
}

/**
 * The best upstream candidate for an <img>: the largest srcset entry when
 * there is one (src is often a small fallback), else src.
 */
export function largestSrc(src: string | null, srcset: string | null): string | null {
  if (!srcset) return src
  let best: string | null = null
  let bestScore = -1
  for (const part of srcset.split(',')) {
    const [url, descriptor = '1x'] = part.trim().split(/\s+/)
    if (!url) continue
    const score = parseFloat(descriptor) * (descriptor.endsWith('x') ? 1000 : 1)
    if (Number.isFinite(score) && score > bestScore) {
      best = url
      bestScore = score
    }
  }
  return best ?? src
}

/**
 * Rewrite every <img> in a sanitized article body to the proxy, lazily
 * loaded and decoded off the main thread. srcset/sizes are dropped: they
 * would let the browser bypass the proxy and pull the original.
 */
export function proxyContentImages(root: ParentNode): void {
  root.querySelectorAll('img').forEach((img) => {
    const upstream = largestSrc(img.getAttribute('src'), img.getAttribute('srcset'))
    const proxied = proxiedImage(upstream, IMAGE_WIDTH.full)
    if (proxied) img.setAttribute('src', proxied)
    img.removeAttribute('srcset')
    img.removeAttribute('sizes')
    img.setAttribute('loading', 'lazy')
    img.setAttribute('decoding', 'async')
  })
}

/**
 * Feed favicons are stored as Google S2 URLs, which answer with a 301 to
 * gstatic's faviconV2 — one extra round trip per icon (64 on /sources).
 * Point straight at the redirect target instead.
 */
const S2_FAVICON = /^https?:\/\/www\.google\.com\/s2\/favicons\?domain=([^&]+)(?:&sz=(\d+))?$/

export function directFaviconUrl(url: string | null | undefined): string | null {
  if (!url) return null
  const m = S2_FAVICON.exec(url)
  if (!m) return url
  const size = m[2] || '32'
  return `https://t1.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=http://${m[1]}&size=${size}`
}
