/**
 * Pure builders for social "share intent" URLs. No SDKs, no tracking — just the
 * public web-intent endpoints that open a pre-filled compose window. Kept pure
 * (no DOM) so they unit-test directly; the reader does the `window.open`.
 */

function clean(s: string | null | undefined): string {
  return (s ?? '').trim()
}

/**
 * X (Twitter) compose intent. X takes `text` and `url` as separate params and
 * renders the URL as its own card, so we keep the title in `text` and the link
 * in `url`.
 */
export function xShareUrl(title: string | null | undefined, url: string): string {
  const params = new URLSearchParams()
  const text = clean(title)
  if (text) params.set('text', text)
  params.set('url', url)
  return `https://x.com/intent/tweet?${params.toString()}`
}

/**
 * Threads compose intent. Threads' intent endpoint has no separate `url` param,
 * so the link is folded into the post text (title + url, or just the url).
 */
export function threadsShareUrl(title: string | null | undefined, url: string): string {
  const text = clean(title)
  const body = text ? `${text} ${url}` : url
  const params = new URLSearchParams({ text: body })
  return `https://www.threads.net/intent/post?${params.toString()}`
}
