/**
 * Deterministic post-extraction cleanup of article bodies, applied at display
 * time on the sanitized DOM (processArticleContent.ts) — the stored body in R2
 * is never touched, so every rule here is reversible and applies to the whole
 * backlog at once. No heuristics that could eat prose: junk removal only fires
 * on exact normalized matches against known page chrome, and the meta-italic
 * pass only decorates. Patterns are distilled from real fetched bodies across
 * the subscribed feeds (Polygon, The Register, LessWrong, Rolling Stone,
 * TechCrunch, Ars, kode24).
 */

/** Standalone chrome blocks: share widgets, ad slots, comment-UI verbs. */
const JUNK_EXACT = new Set([
  'follow',
  'link copied to clipboard',
  'copy link',
  'share',
  'share this article',
  'share this story',
  'skip to content',
  'advertisement',
  'sponsored',
  'reg ad',
  'reply',
  'frontpage',
  'view more',
  'load comments',
  'show comments',
  'read full article',
  'moderation log',
  'curated and popular this week'
])

/** Section headings for recirculation rails that leak into the extraction. */
const RAIL_HEADINGS = new Set([
  'editors picks',
  'editors pick',
  'trending',
  'trending stories',
  'related',
  'related stories',
  'related articles',
  'related posts',
  'most popular',
  'most read',
  'popular now',
  'read more',
  'read next',
  'recommended',
  'recommended for you',
  'you might also like',
  'more from this author',
  'more stories',
  'in this article',
  'table of contents',
  'newsletter',
  'sign up for our newsletter'
])

/**
 * A block matching one of these in the SECOND half of the article marks where
 * the comment section starts — it and everything after are dropped.
 * `[-]…` is LessWrong's collapsed-comment header.
 */
const TAIL_TERMINATORS = [/^\d+\s*comments?$/, /^comments$/, /^moderation log$/, /^\[-\]/]

const AFFILIATE_MARKERS = [
  'affiliate commission',
  'earn a small commission',
  'may earn a commission',
  'affiliate links'
]

const norm = (text: string) => text.replace(/\s+/g, ' ').trim().toLowerCase()
/** Normalization for heading matching: apostrophes/punctuation dropped. */
const normHard = (text: string) => norm(text).replace(/[^\p{L}\p{N} ]/gu, '')

const BLOCK_SELECTOR = 'p, div, h1, h2, h3, h4, h5, h6, li, figure, figcaption, blockquote'

const blockText = (el: Element) => norm(el.textContent || '')
const hasMedia = (el: Element) => !!el.querySelector('img')
/** Blocks with visible text, in document order — the unit all rules work in. */
const textBlocks = (root: HTMLElement) =>
  Array.from(root.querySelectorAll(BLOCK_SELECTOR)).filter((el) => blockText(el).length > 0)

/**
 * Clean extraction junk out of a sanitized article DOM in place, and tag the
 * remaining meta text (bylines, datelines, credits, affiliate disclosures)
 * with the `article-meta` class for italic/muted styling.
 */
export function cleanArticleDom(root: HTMLElement, opts: { title?: string } = {}): void {
  removeDuplicateTitle(root, opts.title)
  removeJunkBlocks(root)
  removeRailHeadings(root)
  cutCommentTail(root)
  trimLeadingScraps(root)
  tagMetaBlocks(root)
  sweepEmptyBlocks(root)
}

/** The page header already shows the title; drop an early duplicate block. */
function removeDuplicateTitle(root: HTMLElement, title?: string) {
  const wanted = title ? normHard(title) : ''
  if (!wanted) return
  for (const el of textBlocks(root).slice(0, 10)) {
    if (el.matches('p, h1, h2, h3') && normHard(el.textContent || '') === wanted) {
      el.remove()
    }
  }
}

function removeJunkBlocks(root: HTMLElement) {
  for (const el of root.querySelectorAll('p, div, li, span, figcaption')) {
    if (hasMedia(el)) continue
    if (JUNK_EXACT.has(blockText(el))) el.remove()
  }
}

function removeRailHeadings(root: HTMLElement) {
  for (const el of root.querySelectorAll('h1, h2, h3, h4, h5, h6')) {
    if (RAIL_HEADINGS.has(normHard(el.textContent || ''))) el.remove()
  }
}

/**
 * Drop the comment section: first terminator block past the article midpoint
 * takes everything after it (in document order) with it. Ancestors of the
 * terminator hold earlier prose and are left alone.
 */
function cutCommentTail(root: HTMLElement) {
  const blocks = textBlocks(root)
  const start = blocks.findIndex((el, i) => {
    if (i < blocks.length / 2) return false
    const text = blockText(el)
    return TAIL_TERMINATORS.some((re) => re.test(text))
  })
  if (start === -1) return

  // Everything after the terminator in document order: at each ancestor
  // level, drop the trailing siblings. Ancestors themselves stay (they hold
  // earlier prose); a now-empty one falls to the empty-block sweep.
  const terminator = blocks[start]
  let node: Element | null = terminator
  while (node && node !== root) {
    while (node.nextSibling) node.nextSibling.remove()
    node = node.parentElement
  }
  terminator.remove()
}

/**
 * Leading scraps before the first real content: stray single characters and
 * bare vote/karma numbers (LessWrong's "x" / "9").
 */
function trimLeadingScraps(root: HTMLElement) {
  const blocks = textBlocks(root)
  // Only articles of real size — a tiny body IS its own content.
  if (blocks.length < 3) return
  for (const el of blocks) {
    if (hasMedia(el)) break
    const text = blockText(el)
    const isScrap = text.length <= 2 || /^\d+$/.test(text)
    if (!isScrap && text.length >= 40) break
    if (isScrap && el.matches('p, div, span')) el.remove()
  }
}

/** Meta text is kept but demoted: italic + muted via `.article-meta`. */
function tagMetaBlocks(root: HTMLElement) {
  for (const el of root.querySelectorAll('p, div')) {
    if (hasMedia(el) || el.querySelector(BLOCK_SELECTOR)) continue
    const raw = (el.textContent || '').replace(/\s+/g, ' ').trim()
    if (!raw) continue
    if (isMetaText(raw)) el.classList.add('article-meta')
  }
}

function isMetaText(raw: string): boolean {
  const text = raw.toLowerCase()

  // Affiliate/commerce disclosures.
  if (raw.length < 300 && AFFILIATE_MARKERS.some((m) => text.includes(m))) return true

  // Datelines: "Published Jul 19, 2026, 1:00 PM EDT". A sentence-ending stop
  // means prose that merely starts with the word ("Published on May 2, 2023,
  // Fourth Wing launched…").
  if (
    raw.length < 100 &&
    /^(published|updated|posted|first published)\b/i.test(raw) &&
    /\d/.test(raw) &&
    !/[.!?]$/.test(raw)
  ) {
    return true
  }

  // Read-time chips, often fused with the byline ("…2 min read3").
  if (raw.length < 90 && /\b\d+\s*min(ute)?s?\s+read\b/i.test(raw)) return true

  // Bylines: short "By Name …" with no sentence punctuation — prose that
  // happens to start with "By" ("By contrast, …") runs longer or ends in
  // a full stop, so it stays untouched.
  if (
    raw.length < 90 &&
    /^by\s+[A-Z]/.test(raw) &&
    raw.split(/\s+/).length <= 6 &&
    !/[.!?]$/.test(raw)
  ) {
    return true
  }

  // Credit lines: "Image: Legendary Entertainment/Universal".
  if (
    raw.length < 120 &&
    /^(image|photo|photograph|illustration|screenshot|graphic|credit|photo credit|source)\s*(:|by\b)/i.test(raw)
  ) {
    return true
  }

  return false
}

/**
 * Remove blocks left with no text and no media — repeatedly, since emptying
 * a child can empty its parent (Readability leaves deep empty <div> nests).
 */
function sweepEmptyBlocks(root: HTMLElement) {
  const selector = 'p, div, li, ul, ol, figure, figcaption, blockquote, h1, h2, h3, h4, h5, h6'
  for (let pass = 0; pass < 8; pass++) {
    let removed = false
    for (const el of root.querySelectorAll(selector)) {
      if (!(el.textContent || '').trim() && !hasMedia(el)) {
        el.remove()
        removed = true
      }
    }
    if (!removed) break
  }
}
