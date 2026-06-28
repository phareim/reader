/**
 * Detects whether a feed body is a *truncated excerpt* — one that ends with a
 * publisher "read more" footer (Ars Technica's `<a>Read full article</a>`,
 * FeedBurner's "Continue reading", a trailing `[…]`, etc.) rather than the
 * whole article.
 *
 * Pure + unit-tested. The reader uses it alongside the length heuristic so a
 * multi-paragraph excerpt that clears THIN_CHARS still triggers a full-text
 * fetch when it is plainly cut off. Conservative by design — it only trusts a
 * read-more phrase that sits in an anchor at the very tail of the content.
 */

// A read-more phrase: starts with read/view/continue and reaches a tell-tale
// word within a few words. Matches "Read full article", "Continue reading",
// "Read the rest of this entry", "View the entire story", "Read more", …
const TRUNCATION_PHRASE =
  /^(read|view|continue)\b[\s\S]{0,40}\b(full|complete|rest|more|reading|entire|article|story|post)\b/i

// How much of the tail we inspect for the footer marker.
const TAIL = 300

export function looksTruncated(html: string | null | undefined, articleUrl?: string): boolean {
  if (!html) return false

  // 1) Trailing bracket ellipsis: "[…]", "[...]", "[&hellip;]", "[Read more]".
  const tail = html.slice(-TAIL)
  if (/\[\s*(…|&hellip;|&#8230;|\.{2,}|read\s+more|more)\s*\]\s*(<\/[a-z]+>\s*)*$/i.test(tail)) return true

  // 2) Scan every anchor and keep the last — feed footers sit at the very end.
  const anchorRe = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi
  let m: RegExpExecArray | null
  let last: { attrs: string; text: string; index: number } | null = null
  while ((m = anchorRe.exec(html))) last = { attrs: m[1], text: m[2], index: m.index }
  if (!last) return false

  // Only trust an anchor that sits in the tail of the content.
  if (last.index < html.length - TAIL) return false

  const text = last.text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().replace(/^[\W_]+/, '')
  if (TRUNCATION_PHRASE.test(text)) return true

  // 3) A short trailing anchor that points back at the article's own URL.
  if (articleUrl && text.length <= 40) {
    const href = /href\s*=\s*["']([^"']+)["']/i.exec(last.attrs)?.[1]
    if (href && sameArticle(href, articleUrl)) return true
  }

  return false
}

/** Compare two URLs ignoring query string, fragment, and a trailing slash. */
function sameArticle(href: string, articleUrl: string): boolean {
  const norm = (u: string) => u.split(/[?#]/)[0].replace(/\/$/, '')
  return norm(href) === norm(articleUrl)
}
