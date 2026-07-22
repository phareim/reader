/**
 * cardData.ts — pure derivations from an Article for the deck card.
 */

const WPM = 220
/** Below this word count we assume the RSS body is an excerpt, not the article. */
const THIN_WORDS = 150

/** Legacy rows carry Unsplash filler from the old feed parser — never show it. */
const FILLER_IMAGE = /(?:images|source)\.unsplash\.com/

/**
 * WordPress-style CDNs serve the un-resized master asset when no width param
 * is present (The Verge ships 11k×7.5k px in its RSS — ~340 MB decoded, which
 * crashes iOS Safari). Their image proxies honor `w=`; plain WP installs
 * ignore unknown params, so appending is always safe.
 */
const WP_UPLOAD_PATH = /\/wp-content\/uploads\//
const CARD_MAX_WIDTH = 1200

function capWordPressWidth(url: string): string {
  if (!WP_UPLOAD_PATH.test(url)) return url
  if (/[?&](w|width)=\d/.test(url)) return url
  return url + (url.includes('?') ? '&' : '?') + `w=${CARD_MAX_WIDTH}`
}

export function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&[a-z#0-9]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function readingTimeMinutes(html: string | null | undefined): number | null {
  if (!html) return null
  const words = stripHtml(html).split(' ').filter(Boolean).length
  if (words < THIN_WORDS) return null
  return Math.ceil(words / WPM)
}

export function cardImageUrl(url: string | null | undefined): string | null {
  if (!url || FILLER_IMAGE.test(url)) return null
  // Legacy rows stored the src straight out of raw feed HTML, where `&` is
  // entity-encoded (`&amp;` / WordPress's `&#038;`). That mangles every query
  // param after the first, so CDNs serve the un-resized master asset — big
  // enough to crash iOS Safari. Decode defensively; a real URL never
  // contains these sequences.
  const decoded = url
    .replace(/&#0*38;/g, '&')
    .replace(/&#x0*26;/gi, '&')
    .replace(/&amp;/gi, '&')
  return capWordPressWidth(decoded)
}

export function excerpt(html: string | null | undefined, maxChars: number): string {
  if (!html) return ''
  const text = stripHtml(html)
  if (text.length <= maxChars) return text
  const cut = text.slice(0, maxChars)
  const lastSpace = cut.lastIndexOf(' ')
  return (lastSpace > 0 ? cut.slice(0, lastSpace) : cut).trimEnd() + '…'
}
