/**
 * cardData.ts — pure derivations from an Article for the deck card.
 */

const WPM = 220
/** Below this word count we assume the RSS body is an excerpt, not the article. */
const THIN_WORDS = 150

/** Legacy rows carry Unsplash filler from the old feed parser — never show it. */
const FILLER_IMAGE = /(?:images|source)\.unsplash\.com/

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
  return url
}

export function excerpt(html: string | null | undefined, maxChars: number): string {
  if (!html) return ''
  const text = stripHtml(html)
  if (text.length <= maxChars) return text
  const cut = text.slice(0, maxChars)
  const lastSpace = cut.lastIndexOf(' ')
  return (lastSpace > 0 ? cut.slice(0, lastSpace) : cut).trimEnd() + '…'
}
