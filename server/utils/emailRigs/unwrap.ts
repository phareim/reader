/**
 * Tracking-redirect unwrapping shared by email rigs.
 *
 * Many newsletter platforms wrap every link in a redirect whose real
 * target is recoverable without a network fetch — it's simply
 * URL-encoded into the wrapper's path. Unwrapping at ingest time makes
 * the stored body readable, the card URL honest, and drops the
 * click-tracking round-trip for the reader.
 */

/**
 * SES/Sendy-style `…/CL0/<encoded target>/<n>/<token>` wrappers
 * (TLDR's tracking.tldrnewsletter.com uses this shape). The target sits
 * percent-encoded between `/CL0/` and the next path segment.
 */
export function unwrapCl0(url: string): string {
  const m = url.match(/\/CL0\/(.+?)\/\d+\//)
  if (!m) return url
  try {
    const target = decodeURIComponent(m[1])
    return /^https?:\/\//i.test(target) ? target : url
  } catch {
    return url
  }
}

/** Apply an unwrapper to every href in an HTML body. */
export function unwrapHrefs(html: string, unwrap: (url: string) => string): string {
  return html.replace(/href=(["'])(https?:\/\/[^"']+)\1/gi, (all, quote, url) => {
    const target = unwrap(url)
    return target === url ? all : `href=${quote}${target}${quote}`
  })
}

/**
 * Drop 1×1/2×2 open-tracker images. Only removes an <img> that declares
 * a tiny width or height attribute — a conservative match that can't
 * touch real imagery.
 */
export function stripTrackingPixels(html: string): string {
  return html.replace(/<img\b[^>]*>/gi, (tag) => {
    const dim = (attr: string) => tag.match(new RegExp(`\\b${attr}=["']?(\\d+)`, 'i'))?.[1]
    const w = dim('width')
    const h = dim('height')
    return (w !== undefined && Number(w) <= 2) || (h !== undefined && Number(h) <= 2) ? '' : tag
  })
}
