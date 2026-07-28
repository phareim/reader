import { parseHTML } from 'linkedom/worker'
import type { FeedRig } from './types'
import { escapeHtml } from './rigHtml'
import { extractLeadImage } from '~/server/utils/extractContent'

/**
 * anthropic.com (news + engineering posts, reached via the Anthropic bridge
 * feeds or any saved anthropic.com link).
 *
 * Generic Readability gets the prose but botches the edges: the update
 * banner (`ul.LatestUpdates…`) renders as a broken list, the "Related
 * content" cards + inline SVG arrows survive as a junk tail, and the
 * footnotes never make it in at all — they live in a `div…__footnotes`
 * OUTSIDE the `<article>` element, so Readability discards them while the
 * in-text `<sup>` markers keep pointing at nothing.
 *
 * extract: scope to `<article>` (which alone drops the related-content
 * tail), rewrite update banners as honest prose, unwrap `/_next/image`
 * proxy URLs to the CDN originals, strip presentation attributes, and
 * re-attach the footnotes from outside the article. Lead image from
 * og:image. No entry hook — bridge items are link-only by design.
 */

const MIN_VISIBLE_CHARS = 200

const DROPPED_ATTRS = new Set(['class', 'style', 'srcset', 'sizes', 'decoding', 'loading'])

export const anthropicRig: FeedRig = {
  id: 'anthropic',
  hosts: ['anthropic.com'],

  async extract({ url, html }) {
    const { document } = parseHTML(html)
    // The post body lives in the INNERMOST article — the outer one wraps
    // the hero header (kicker/title/date the reader already renders itself).
    let article = document.querySelector('article')
    if (!article) return null
    for (let inner = article.querySelector('article'); inner; inner = inner.querySelector('article')) {
      article = inner
    }

    // Update banners → prose the reader can style.
    for (const banner of article.querySelectorAll('ul[class*="LatestUpdates"]')) {
      const paragraphs: string[] = []
      for (const li of banner.querySelectorAll('li')) {
        // NB: "__date"/"__summary" — a bare [class*="date"] also matches
        // the "…__update" wrapper (upDATE).
        const headline = textOf(li.querySelector('p'))
        const date = textOf(li.querySelector('[class*="__date"]'))
        const summary = textOf(li.querySelector('[class*="__summary"]'))
        const body = [headline, summary].filter(Boolean).join(' — ')
        if (!body) continue
        const label = date ? `Update (${date})` : 'Update'
        paragraphs.push(`<p><em>${escapeHtml(`${label}: ${body}`)}</em></p>`)
      }
      replaceWithHtml(document, banner, paragraphs.join(''))
    }

    for (const svg of [...article.querySelectorAll('svg')]) svg.remove()

    cleanBody(article, url)

    const footnotes = extractFootnotes(document, url)
    const body = article.innerHTML.trim() + footnotes

    const visible = body.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    if (visible.length < MIN_VISIBLE_CHARS) return null

    return { html: body, imageUrl: extractLeadImage(html, url) }
  }
}

function textOf(el: any): string {
  return el?.textContent?.replace(/\s+/g, ' ').trim() ?? ''
}

function replaceWithHtml(document: any, el: any, htmlString: string): void {
  const holder = document.createElement('div')
  holder.innerHTML = htmlString
  el.replaceWith(...holder.childNodes)
}

/**
 * Normalize a container in place: absolute URLs (with `/_next/image` proxy
 * srcs unwrapped to the CDN original), presentation attributes dropped, and
 * empty padding paragraphs removed.
 */
function cleanBody(container: any, baseUrl: string): void {
  for (const img of [...container.querySelectorAll('img')]) {
    const src = unproxiedSrc(img.getAttribute('src') ?? '', baseUrl)
    if (src) img.setAttribute('src', src)
    else img.remove()
  }

  for (const a of container.querySelectorAll('a[href]')) {
    const href = a.getAttribute('href') ?? ''
    if (href.startsWith('#')) continue // in-page footnote/anchor links
    const resolved = httpUrl(href, baseUrl)
    if (resolved) a.setAttribute('href', resolved)
    else a.removeAttribute('href')
  }

  // NB: linkedom preserves source attribute casing (`srcSet`), so drop by
  // lowercased name rather than removeAttribute('srcset').
  for (const el of container.querySelectorAll('*')) {
    for (const attr of [...el.attributes]) {
      const name = attr.name.toLowerCase()
      if (DROPPED_ATTRS.has(name) || name.startsWith('data-')) el.removeAttribute(attr.name)
    }
  }

  // The CMS pads posts with empty <p><br></p> paragraphs.
  for (const p of [...container.querySelectorAll('p')]) {
    if (!p.textContent?.trim() && !p.querySelector('img')) p.remove()
  }
}

/** Resolve an `/_next/image?url=…` proxy src to the CDN original. */
function unproxiedSrc(src: string, baseUrl: string): string | null {
  const resolved = httpUrl(src, baseUrl)
  if (!resolved) return null
  try {
    const url = new URL(resolved)
    if (url.pathname === '/_next/image') {
      const original = url.searchParams.get('url')
      const unwrapped = original ? httpUrl(original, baseUrl) : null
      if (unwrapped) return unwrapped
    }
  } catch {
    // keep the resolved src
  }
  return resolved
}

/** The footnotes block lives outside <article>; re-attach it. */
function extractFootnotes(document: any, baseUrl: string): string {
  const block = document.querySelector('div[class*="footnotes"]')
  const list = block?.querySelector('ol, ul')
  if (!list) return ''
  cleanBody(list, baseUrl)
  const heading = textOf(block.querySelector('h1, h2, h3, h4, h5')) || 'Footnotes'
  return `<h2>${escapeHtml(heading)}</h2>${list.outerHTML}`
}

function httpUrl(value: string, base: string): string | null {
  try {
    const url = new URL(value, base)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null
  } catch {
    return null
  }
}
