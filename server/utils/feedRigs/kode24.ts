import type { FeedRig } from './types'
import { extractReadableContent } from '~/server/utils/extractContent'

/**
 * kode24 (kode24.no).
 *
 * The RSS body is excerpt-only, so every article goes through full-text
 * fetch — where Readability drops every image on the page. Two of the CMS's
 * class names trip Readability's heuristics: the lead <figure> is
 * class="hello2 headerImage" ("header" matches the unlikely-candidates
 * regex), and each image block sits in <div class="media"> ("media" is in
 * the negative-scoring class regex, −25 ⇒ conditionally cleaned). The
 * captions live *outside* those wrappers, which is why articles rendered
 * with orphaned figcaptions and no pictures.
 *
 * extract: neutralize the two class names, then run the generic Readability
 * extraction on the treated page. Only accept when that actually won an
 * <img>; otherwise fall back to the untreated generic path unchanged.
 */
export const kode24Rig: FeedRig = {
  id: 'kode24',
  hosts: ['kode24.no', 'rss.kode24.no'],

  async extract({ url, html }) {
    const treated = html
      .replace(/class="media"/g, 'class="k24-photo"')
      .replace(/\bheaderImage\b/g, 'k24-lead-figure')
    if (treated === html) return null

    const extracted = extractReadableContent(treated, url)
    if (!extracted || extracted.source !== 'readability') return null
    if (!/<img\b/i.test(extracted.html)) return null

    return { html: extracted.html }
  }
}
