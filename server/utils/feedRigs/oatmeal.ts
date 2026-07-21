import type { FeedRig } from './types'
import { escapeHtml, attrOf, absoluteUrl } from './rigHtml'

/**
 * The Oatmeal (theoatmeal.com).
 *
 * The RSS body is a teaser thumbnail plus a "View on my website" link —
 * the actual comic is an image sequence on the page, every panel served
 * from theoatmeal-img/comics/ (recirculation thumbnails live under
 * /thumbnails/, so the src path alone separates strip from chrome).
 *
 * entry: drop the "View on my website" link (the card thumbnail + blurb
 * stay; the open-time fetch replaces the body via extract).
 * extract: the panel sequence, in page order.
 */
export const oatmealRig: FeedRig = {
  id: 'oatmeal',
  hosts: ['theoatmeal.com'],

  entry(item) {
    const content = item.content || ''
    const cleaned = content
      .replace(/<a\b[^>]*>\s*View on my website\s*<\/a>/gi, '')
      .replace(/(\s*<br\s*\/?>\s*)+$/i, '')
    return cleaned === content ? item : { ...item, content: cleaned }
  },

  async extract({ url, html }) {
    const panels: string[] = []
    for (const imgTag of html.match(/<img\b[^>]*>/gi) || []) {
      const src = attrOf(imgTag, 'src')
      if (!src || !/theoatmeal-img\/comics\//i.test(src)) continue
      const resolved = absoluteUrl(src, url)
      if (resolved && !panels.includes(resolved)) panels.push(resolved)
    }
    if (!panels.length) return null

    return {
      html: panels.map((src) => `<p><img src="${escapeHtml(src)}" alt=""></p>`).join(''),
      imageUrl: panels[0]
    }
  }
}
