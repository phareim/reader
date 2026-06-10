import { Readability } from '@mozilla/readability'
import { parseHTML } from 'linkedom/worker'
import { paragraphize } from '~/utils/paragraphize'

/**
 * Readability-based article extraction. Pure (no D1/R2/h3 imports) so it
 * can be unit-tested directly. Returns rich HTML; the client sanitizes at
 * display time (utils/processArticleContent.ts).
 */

export type ExtractedContent = { html: string; source: 'readability' | 'fallback' }

const MIN_TEXT_CHARS = 200

export function extractReadableContent(html: string, articleUrl: string): ExtractedContent | null {
  const readable = extractWithReadability(html, articleUrl)
  if (readable) return { html: readable, source: 'readability' }

  const plain = extractPlainText(html)
  if (plain.length < MIN_TEXT_CHARS) return null
  return { html: paragraphize(plain), source: 'fallback' }
}

const LEAD_IMAGE_META_SELECTORS = [
  'meta[property="og:image:secure_url"]',
  'meta[property="og:image"]',
  'meta[name="og:image"]',
  'meta[name="twitter:image"]',
  'meta[property="twitter:image"]',
  'meta[name="twitter:image:src"]'
]

/**
 * Pick a lead image for the article: the publisher's og:image / twitter:image
 * from the page head, else the first <img> in the extracted content (whose
 * URLs are already absolute). Returns null when nothing usable is found.
 */
export function extractLeadImage(pageHtml: string, articleUrl: string, contentHtml?: string): string | null {
  try {
    const { document } = parseHTML(pageHtml)
    for (const selector of LEAD_IMAGE_META_SELECTORS) {
      const content = document.querySelector(selector)?.getAttribute('content')?.trim()
      const resolved = httpUrl(content, articleUrl)
      if (resolved) return resolved
    }
  } catch {
    // fall through to the content image
  }

  if (contentHtml) {
    const imgMatch = contentHtml.match(/<img[^>]+src=["']([^"']+)["']/i)
    const resolved = httpUrl(imgMatch?.[1], articleUrl)
    if (resolved) return resolved
  }

  return null
}

function httpUrl(value: string | null | undefined, base: string): string | null {
  if (!value) return null
  try {
    const url = new URL(value, base)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null
  } catch {
    return null
  }
}

/**
 * linkedom resolves baseURI from a <base> tag (or falls back to the global
 * location, which is wrong/absent outside a browser). Injecting the article
 * URL as <base> makes Readability resolve relative URIs correctly.
 */
function injectBase(html: string, articleUrl: string): string {
  const baseTag = `<base href="${articleUrl.replace(/"/g, '&quot;')}">`
  if (/<head[^>]*>/i.test(html)) {
    return html.replace(/<head[^>]*>/i, (match) => match + baseTag)
  }
  return baseTag + html
}

function extractWithReadability(html: string, articleUrl: string): string | null {
  try {
    // Readability mutates the document, so parse fresh per call.
    const { document } = parseHTML(injectBase(html, articleUrl))

    // Promote lazy-loaded images so Readability keeps them.
    for (const img of document.querySelectorAll('img[data-src], img[data-srcset]')) {
      const src = img.getAttribute('src') || ''
      const dataSrc = img.getAttribute('data-src')
      if (dataSrc && !/^https?:\/\//i.test(src)) img.setAttribute('src', dataSrc)
      const dataSrcset = img.getAttribute('data-srcset')
      if (dataSrcset && !img.getAttribute('srcset')) img.setAttribute('srcset', dataSrcset)
    }

    const article = new Readability(document as unknown as Document).parse()
    if (!article?.content) return null

    const body = resolveUrls(article.content, articleUrl)
    if (!body) return null

    const textLength = (body.textContent || '').trim().length
    if (textLength < MIN_TEXT_CHARS) return null

    return body.innerHTML
  } catch {
    return null
  }
}

/**
 * linkedom has no base-URL support, so relative hrefs/srcs in Readability's
 * output are resolved here against the article URL.
 */
function resolveUrls(contentHtml: string, articleUrl: string): any | null {
  try {
    const { document } = parseHTML(`<html><body>${contentHtml}</body></html>`)
    const body = document.querySelector('body')
    if (!body) return null

    for (const el of body.querySelectorAll('a[href]')) {
      el.setAttribute('href', resolveUrl(el.getAttribute('href'), articleUrl))
    }
    for (const el of body.querySelectorAll('img[src]')) {
      el.setAttribute('src', resolveUrl(el.getAttribute('src'), articleUrl))
    }
    for (const el of body.querySelectorAll('[srcset]')) {
      el.setAttribute('srcset', resolveSrcset(el.getAttribute('srcset') || '', articleUrl))
    }

    return body
  } catch {
    return null
  }
}

function resolveUrl(value: string | null, base: string): string {
  if (!value) return ''
  try {
    return new URL(value, base).href
  } catch {
    return value
  }
}

function resolveSrcset(srcset: string, base: string): string {
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
 * The pre-Readability regex pipeline, kept as a fallback for pages
 * Readability can't parse. Returns decoded plain text.
 */
export function extractPlainText(html: string): string {
  // Remove script, style, nav, footer, aside, header tags and their contents
  let cleaned = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '')
    .replace(/<aside[\s\S]*?<\/aside>/gi, '')
    .replace(/<header[\s\S]*?<\/header>/gi, '')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, '')
    .replace(/<form[\s\S]*?<\/form>/gi, '')

  // Try to extract <article> content first
  const articleMatch = cleaned.match(/<article[\s\S]*?>([\s\S]*?)<\/article>/i)
  if (articleMatch) {
    cleaned = articleMatch[1]
  } else {
    // Fall back to <main> content
    const mainMatch = cleaned.match(/<main[\s\S]*?>([\s\S]*?)<\/main>/i)
    if (mainMatch) {
      cleaned = mainMatch[1]
    } else {
      // Fall back to body
      const bodyMatch = cleaned.match(/<body[\s\S]*?>([\s\S]*?)<\/body>/i)
      if (bodyMatch) {
        cleaned = bodyMatch[1]
      }
    }
  }

  // Keep paragraph and heading content, strip remaining tags
  // First, preserve paragraph breaks
  cleaned = cleaned
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/h[1-6]>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/li>/gi, '\n')

  // Strip all remaining HTML tags
  cleaned = cleaned.replace(/<[^>]+>/g, '')

  // Decode common HTML entities
  cleaned = cleaned
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/')

  // Clean up whitespace
  cleaned = cleaned
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n\s*\n/g, '\n\n')
    .trim()

  return cleaned
}
