import { hasValidSession } from '~/server/utils/session'
import { PROXY_WIDTHS } from '~/utils/imageProxy'

/**
 * GET /api/img?w=<width>&u=<remote image url>
 *
 * Width-capped WebP copies of remote article images, via the Worker's
 * Cloudflare Images binding (`IMAGES` in wrangler.toml). Clients build these
 * URLs with utils/imageProxy.ts.
 *
 * - Results land in the edge cache (Cache API) and the browser cache for a
 *   year; a cache hit skips auth, upstream, and the transform.
 * - Small images pass through untouched: they cost nothing to serve as-is and
 *   would only burn the free tier's 5,000 unique transformations a month.
 * - Anything that goes wrong (upstream blocks the Worker, not an image, the
 *   transformation quota is spent) falls back to the original: a redirect when
 *   we have no bytes, the untouched bytes when we do. Images never break
 *   because of the proxy.
 */

const PASSTHROUGH_BYTES = 150 * 1024
const MAX_UPSTREAM_BYTES = 25 * 1024 * 1024
const UPSTREAM_TIMEOUT_MS = 10_000
const YEAR = 60 * 60 * 24 * 365

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const src = String(query.u || '')
  const width = Number(query.w)

  let upstreamUrl: URL
  try {
    upstreamUrl = new URL(src)
  } catch {
    throw createError({ statusCode: 400, statusMessage: 'Invalid image URL' })
  }
  if (upstreamUrl.protocol !== 'https:' && upstreamUrl.protocol !== 'http:') {
    throw createError({ statusCode: 400, statusMessage: 'Invalid image URL' })
  }
  if (!PROXY_WIDTHS.includes(width)) {
    throw createError({ statusCode: 400, statusMessage: 'Unsupported width' })
  }

  const cf = event.context.cloudflare
  const cache: Cache | undefined = (globalThis as any).caches?.default
  const cacheKey = new Request(getRequestURL(event).toString())

  const hit = await cache?.match(cacheKey)
  if (hit) return hit

  // Only signed-in readers may make the Worker fetch and transform — an open
  // proxy would spend the quota on anyone's images.
  if (!(await hasValidSession(event))) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  // Cache and return. Redirect fallbacks are cached for a day so a host that
  // blocks the Worker isn't re-fetched on every view.
  const respond = async (response: Response) => {
    if (cache) {
      const put = cache.put(cacheKey, response.clone()).catch(() => {})
      cf?.context?.waitUntil ? cf.context.waitUntil(put) : await put
    }
    return response
  }
  const fallback = () => respond(new Response(null, {
    status: 302,
    headers: { location: upstreamUrl.toString(), 'cache-control': 'public, max-age=86400' },
  }))

  let upstream: Response
  try {
    upstream = await fetch(upstreamUrl.toString(), {
      headers: { accept: 'image/avif,image/webp,image/*;q=0.8' },
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    })
  } catch {
    return fallback()
  }
  const type = upstream.headers.get('content-type') || ''
  const declared = Number(upstream.headers.get('content-length') || 0)
  if (!upstream.ok || !type.startsWith('image/') || declared > MAX_UPSTREAM_BYTES) {
    return fallback()
  }

  const original = await upstream.arrayBuffer()
  let body: ArrayBuffer | ReadableStream = original
  let contentType = type
  let mode = 'passthrough'

  // SVG is already small and scalable; GIFs may be animated.
  const transformable = !/svg|gif/.test(type)
  const images = cf?.env?.IMAGES
  if (images && transformable && original.byteLength > PASSTHROUGH_BYTES) {
    try {
      const out = await images
        .input(new Blob([original]).stream())
        .transform({ width, fit: 'scale-down' })
        .output({ format: 'image/webp', quality: 80 })
      const res: Response = out.response()
      const transformed = await res.arrayBuffer()
      if (transformed.byteLength < original.byteLength) {
        body = transformed
        contentType = 'image/webp'
        mode = 'webp'
      }
    } catch {
      // Quota spent or an input Images can't read — serve the original.
    }
  }

  return respond(new Response(body, {
    headers: {
      'content-type': contentType,
      'cache-control': `public, max-age=${YEAR}, immutable`,
      'x-reader-img': mode,
    },
  }))
})
