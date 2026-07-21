import type { FeedRig } from './types'
import { escapeHtml, attrOf, absoluteUrl } from './rigHtml'

/**
 * The Oatmeal (theoatmeal.com).
 *
 * The RSS body is a teaser thumbnail plus a "View on my website" link —
 * the actual comic is an image sequence on the page, every panel served
 * from theoatmeal-img/comics/<page slug>/ (or comics/<slug>.png for
 * single-image strips). The slug filter matters: recirculation images from
 * OTHER comics also live under /comics/, so path-prefix alone is too loose.
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
    const slug = (() => {
      try {
        return new URL(url).pathname.split('/').filter(Boolean).pop() || null
      } catch {
        return null
      }
    })()
    if (!slug) return null
    const ownPanel = new RegExp(
      `theoatmeal-img/comics/${slug.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[/.]`,
      'i'
    )

    const panels: string[] = []
    for (const imgTag of html.match(/<img\b[^>]*>/gi) || []) {
      const src = attrOf(imgTag, 'src')
      if (!src || !ownPanel.test(src)) continue
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
