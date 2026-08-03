/**
 * Resolve relative `href`/`src`/`srcset` values in a fragment of article HTML
 * against a base URL. Shared by the full-text Readability path
 * (extractContent.ts) and the raw RSS body path (feedParser.ts) — both store
 * publisher HTML that can carry root- or document-relative URLs, which break
 * once rendered on a different origin (reader.phareim.no).
 */
import { parseHTML } from 'linkedom/worker'

export function resolveUrl(value: string | null | undefined, base: string): string {
  if (!value) return ''
  try {
    return new URL(value, base).href
  } catch {
    return value
  }
}

export function resolveSrcset(srcset: string, base: string): string {
  return srcset
    .split(',')
    .map((candidate) => {
      const trimmed = candidate.trim()
      if (!trimmed) return trimmed
      const [url, ...descriptor] = trimmed.split(/\s+/)
      return [resolveUrl(url, base), ...descriptor].join(' ')
    })
    .filter((candidate) => candidate.length > 0)
    .join(', ')
}

/**
 * Rewrite every relative `a[href]` / `img[src]` / `[srcset]` in an HTML
 * fragment to an absolute URL. Fails soft to the original HTML on parse
 * error — a broken rewrite must never lose the body.
 */
export function resolveContentUrls(html: string, baseUrl: string): string {
  if (!html) return html
  try {
    const { document } = parseHTML(`<html><body>${html}</body></html>`)
    const body = document.querySelector('body')
    if (!body) return html

    for (const el of body.querySelectorAll('a[href]')) {
      el.setAttribute('href', resolveUrl(el.getAttribute('href'), baseUrl))
    }
    for (const el of body.querySelectorAll('img[src]')) {
      el.setAttribute('src', resolveUrl(el.getAttribute('src'), baseUrl))
    }
    for (const el of body.querySelectorAll('[srcset]')) {
      el.setAttribute('srcset', resolveSrcset(el.getAttribute('srcset') || '', baseUrl))
    }

    return body.innerHTML
  } catch {
    return html
  }
}
