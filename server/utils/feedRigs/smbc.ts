import type { FeedRig } from './types'
import { escapeHtml, tagWithId, attrOf, sectionAfterId, absoluteUrl } from './rigHtml'

/**
 * Saturday Morning Breakfast Cereal (smbc-comics.com).
 *
 * The RSS body wraps the comic in a "Click here to go see the bonus panel!"
 * link and drags a dangling "Today's News:" tail along; the bonus panel
 * itself (the votey) only exists on the comic page, hidden in a
 * `#aftercomic` block, with the hovertext in `#cc-comic`'s title attribute.
 *
 * entry: rebuild the RSS body as comic + hovertext, drop the junk, and trim
 * the redundant "Saturday Morning Breakfast Cereal - " title prefix.
 * extract: comic + hovertext + bonus panel straight off the page.
 */

const TITLE_PREFIX = /^Saturday Morning Breakfast Cereal\s*-\s*/i

const comicBody = (src: string, hovertext: string | null, voteySrc?: string | null): string => {
  let html = `<p><img src="${escapeHtml(src)}" alt=""></p>`
  if (hovertext) html += `<p><em>${escapeHtml(hovertext)}</em></p>`
  if (voteySrc) html += `<p><img src="${escapeHtml(voteySrc)}" alt="Bonus panel"></p>`
  return html
}

export const smbcRig: FeedRig = {
  id: 'smbc',
  hosts: ['smbc-comics.com'],

  entry(item) {
    const content = item.content || ''
    const imgTag = content.match(/<img\b[^>]*>/i)?.[0]
    const src = imgTag ? attrOf(imgTag, 'src') : null
    if (!src) return item

    // "Hovertext:<br/>the joke</p>" — take the text up to the next tag.
    const hovertext = content.match(/Hovertext:\s*(?:<br\s*\/?>)?\s*([^<]+)/i)?.[1]?.trim() || null

    const title = item.title.replace(TITLE_PREFIX, '').trim() || item.title
    return {
      ...item,
      title,
      content: comicBody(src, hovertext),
      summary: hovertext ? hovertext.slice(0, 500) : item.summary,
      imageUrl: src
    }
  },

  async extract({ url, html }) {
    const comicTag = tagWithId(html, 'img', 'cc-comic')
    const src = comicTag ? absoluteUrl(attrOf(comicTag, 'src') || '', url) : null
    if (!src) return null

    const hovertext = comicTag ? attrOf(comicTag, 'title') : null

    const voteySection = sectionAfterId(html, 'aftercomic')
    const voteyTag = voteySection?.match(/<img\b[^>]*>/i)?.[0]
    const voteySrc = voteyTag ? absoluteUrl(attrOf(voteyTag, 'src') || '', url) : null

    return { html: comicBody(src, hovertext, voteySrc), imageUrl: src }
  }
}
