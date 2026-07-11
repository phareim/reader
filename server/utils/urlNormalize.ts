/**
 * URL normalization for cross-source dedup in the Found feed.
 *
 * The same link often arrives from two collectors under different guids —
 * an X post saved as an X bookmark (`x-bookmark:<id>`) and mirrored later by
 * the sleeper-articles collector (`sleeper-articles:<id>`), or a blog post
 * favorited on both HN and Reddit. Guid dedup can't see that; a normalized
 * URL can. `Article.url_norm` stores this form at insert time (migration
 * 012) and the ingest paths skip a Found card whose url_norm already exists
 * in the feed.
 *
 * Normalization is deliberately conservative: identical pages must collide,
 * but two different pages must never be folded together.
 */

// Query params that only ever carry tracking/attribution — safe to strip
// on any host. Deliberately NOT stripping short ambiguous keys like `t`
// or `s` globally (YouTube `t` is a timestamp).
const TRACKING_PARAMS = new Set([
  'fbclid', 'gclid', 'dclid', 'msclkid', 'twclid', 'igshid', 'igsh',
  'mc_cid', 'mc_eid', 'ref_src', 'ref_url', 'cmpid', 'smid', 'sref',
  'guccounter', 'guce_referrer', 'guce_referrer_sig', 'si',
])

/** Hosts whose canonical page is fully identified by the path alone.
 *  (NOT news.ycombinator.com — its pages live in the `id` param.) */
const PATH_ONLY_HOSTS = new Set(['x.com'])

const HOST_ALIASES: Record<string, string> = {
  'twitter.com': 'x.com',
  'mobile.twitter.com': 'x.com',
  'fxtwitter.com': 'x.com',
  'vxtwitter.com': 'x.com',
}

/**
 * Canonicalize a URL to a comparison key: scheme dropped (http/https equal),
 * `www.` and mirror hosts folded, fragment dropped, tracking params
 * stripped, remaining params sorted, trailing slash trimmed.
 * Returns null for anything that doesn't parse as an http(s) URL.
 */
export function normalizeUrl(raw: string): string | null {
  let u: URL
  try {
    u = new URL(raw)
  } catch {
    return null
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return null

  let host = u.hostname.toLowerCase()
  if (host.startsWith('www.')) host = host.slice(4)
  host = HOST_ALIASES[host] || host

  let path = u.pathname
  if (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1)

  let query = ''
  if (!PATH_ONLY_HOSTS.has(host)) {
    const params = [...u.searchParams.entries()]
      .filter(([key]) => {
        const k = key.toLowerCase()
        return !k.startsWith('utm_') && !TRACKING_PARAMS.has(k)
      })
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    if (params.length) {
      query = '?' + params.map(([k, v]) => `${k}=${v}`).join('&')
    }
  }

  return `${host}${path}${query}`
}
