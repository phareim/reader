import type { FeedRig } from './types'
import { escapeHtml, tagWithId, attrOf, sectionAfterId, absoluteUrl } from './rigHtml'

/**
 * xkcd (xkcd.com).
 *
 * The RSS body is a single <img> whose punchline lives in the title
 * attribute — hover-only, invisible on touch and never surfaced by the
 * reader. Also the feed behind the acceptExtraction guard: Readability on
 * an xkcd page latches onto the footer chrome instead of the comic.
 *
 * entry: render image + caption straight from the RSS; the body is then
 * complete — no page fetch, ever.
 * extract: same body off the page (`#comic`), for upgrading rows that were
 * stored before the rig existed.
 */

const comicBody = (src: string, caption: string | null): string => {
  let html = `<p><img src="${escapeHtml(src)}" alt=""></p>`
  if (caption) html += `<p><em>${escapeHtml(caption)}</em></p>`
  return html
}

export const xkcdRig: FeedRig = {
  id: 'xkcd',
  hosts: ['xkcd.com'],

  entry(item) {
    const imgTag = (item.content || '').match(/<img\b[^>]*>/i)?.[0]
    const src = imgTag ? attrOf(imgTag, 'src') : null
    if (!src) return item

    const caption = imgTag ? attrOf(imgTag, 'title') : null
    return {
      ...item,
      content: comicBody(src, caption),
      summary: caption ? caption.slice(0, 500) : item.summary,
      imageUrl: src,
      fullTextComplete: true
    }
  },

  async extract({ url, html }) {
    const section = sectionAfterId(html, 'comic')
    const imgTag = section?.match(/<img\b[^>]*>/i)?.[0]
    // xkcd image srcs are protocol-relative (//imgs.xkcd.com/…).
    const src = imgTag ? absoluteUrl(attrOf(imgTag, 'src') || '', url) : null
    if (!src) return null

    const caption = imgTag ? attrOf(imgTag, 'title') : null
    return { html: comicBody(src, caption), imageUrl: src }
  }
}
