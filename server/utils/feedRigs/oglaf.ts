import type { FeedRig } from './types'
import { escapeHtml, tagWithId, attrOf, nextLinkHref, absoluteUrl } from './rigHtml'

/**
 * Oglaf (oglaf.com).
 *
 * The RSS body carries only a story-title card and an archive banner — the
 * strip itself sits on the comic page behind an age-confirmation interstitial.
 * That gate is client-side JavaScript only (check-age-confirmation.js), so a
 * plain server fetch gets the full page with `<img id="strip">`, whose title
 * attribute holds the hover joke. Multi-page stories chain via `rel="next"`
 * links whose path stays under the story slug (`/story/2/`, `/story/3/`, …);
 * once next points at a different slug it's the following story — stop.
 *
 * entry: drop the archive banner (pure chrome; the title card stays as the
 * pre-fetch body and card image).
 * extract: walk the story's pages, one <img> + hover-joke caption per page.
 */

const MAX_STORY_PAGES = 12

export const oglafRig: FeedRig = {
  id: 'oglaf',
  hosts: ['oglaf.com'],

  entry(item) {
    const content = item.content || ''
    const cleaned = content.replace(
      /<p>\s*<a\b[^>]*>\s*<img\b[^>]*\/archive\/arc-[^>]*>\s*<\/a>\s*<\/p>/gi,
      ''
    )
    return cleaned === content ? item : { ...item, content: cleaned }
  },

  async extract({ url, html, fetchPage }) {
    const basePath = (() => {
      try { return new URL(url).pathname } catch { return null }
    })()
    if (!basePath) return null

    const pages: { src: string; caption: string | null }[] = []
    let pageHtml = html
    let pageUrl = url

    for (let i = 0; i < MAX_STORY_PAGES; i++) {
      const stripTag = tagWithId(pageHtml, 'img', 'strip')
      const src = stripTag ? absoluteUrl(attrOf(stripTag, 'src') || '', pageUrl) : null
      if (!src) break

      const title = stripTag ? attrOf(stripTag, 'title') : null
      pages.push({ src, caption: title && title !== 'None' ? title : null })

      const nextHref = nextLinkHref(pageHtml)
      const nextUrl = nextHref ? absoluteUrl(nextHref, pageUrl) : null
      if (!nextUrl) break
      const nextPath = new URL(nextUrl).pathname
      // Only follow pages of the SAME story; the last page's next is the
      // following story (or absent on the latest strip).
      if (!nextPath.startsWith(basePath) || nextPath === new URL(pageUrl).pathname) break

      const fetched = await fetchPage(nextUrl)
      if (!fetched) break
      pageHtml = fetched
      pageUrl = nextUrl
    }

    if (!pages.length) return null

    const body = pages
      .map(
        (p) =>
          `<p><img src="${escapeHtml(p.src)}" alt=""></p>` +
          (p.caption ? `<p><em>${escapeHtml(p.caption)}</em></p>` : '')
      )
      .join('')

    return { html: body, imageUrl: pages[0].src }
  }
}
