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
 * so only the link goes in `text` — Threads renders it as a link card, and the
 * title would otherwise show as raw text the user has to delete.
 */
export function threadsShareUrl(url: string): string {
  const params = new URLSearchParams({ text: url })
  return `https://www.threads.net/intent/post?${params.toString()}`
}
