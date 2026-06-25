/**
 * DOM anchoring for highlights. The reader injects the article body as a
 * deterministic HTML string via `v-html`, so we anchor marks to plain-text
 * character offsets into the article element's `textContent`. The exact quote
 * string is kept as a fallback locator for when offsets drift (e.g. after the
 * one-time full-text upgrade re-renders the body).
 *
 * Framework-free and DOM-only so Jest (jsdom) can exercise it directly.
 */

export interface HighlightAnchor {
  id: number | string
  startOffset: number
  endOffset: number
  quote: string
}

/** Climb to `rootEl`; true if `node` already sits inside a painted mark. */
function isInsideMark(node: Node, rootEl: Node): boolean {
  let cur: Node | null = node
  while (cur && cur !== rootEl) {
    if (
      cur.nodeType === 1 &&
      (cur as Element).tagName === 'MARK' &&
      (cur as Element).classList.contains('hl')
    ) {
      return true
    }
    cur = cur.parentNode
  }
  return false
}

/**
 * Number of `textContent` characters in `rootEl` that fall strictly before the
 * DOM boundary (container, offset). Walks text nodes and uses Range.comparePoint
 * so element-expressed boundaries (between child nodes) map correctly.
 */
function offsetWithin(rootEl: Node, container: Node, offset: number): number {
  const boundary = document.createRange()
  boundary.setStart(container, offset)
  boundary.collapse(true)

  const walker = document.createTreeWalker(rootEl, NodeFilter.SHOW_TEXT)
  let count = 0
  let node: Node | null
  while ((node = walker.nextNode())) {
    const text = node as Text
    const len = text.length
    // End of this text node at/before the boundary → whole node precedes it.
    if (boundary.comparePoint(text, len) <= 0) {
      count += len
      continue
    }
    // End is after the boundary. If the node's start is also after, the
    // boundary lies before this node and we're done.
    if (boundary.comparePoint(text, 0) > 0) break
    // Boundary falls within this node. A strictly-interior boundary can only be
    // expressed against this very text node; element-expressed boundaries land
    // on a node edge and are handled by the branches above.
    if (container === text) count += offset
    break
  }
  return count
}

/**
 * Map the current selection to character offsets + the trimmed quote, or null
 * if the selection is empty/collapsed or falls outside `rootEl`.
 */
export function getSelectionOffsets(
  rootEl: HTMLElement,
): { startOffset: number; endOffset: number; quote: string } | null {
  const sel = typeof window !== 'undefined' ? window.getSelection() : null
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return null

  const range = sel.getRangeAt(0)
  if (!rootEl.contains(range.commonAncestorContainer)) return null

  let startOffset = offsetWithin(rootEl, range.startContainer, range.startOffset)
  let endOffset = offsetWithin(rootEl, range.endContainer, range.endOffset)
  if (endOffset <= startOffset) return null

  const full = rootEl.textContent || ''
  let quote = full.slice(startOffset, endOffset)

  // Trim surrounding whitespace (common with double/triple-click) and shift the
  // offsets to keep them consistent with the stored quote.
  startOffset += quote.length - quote.trimStart().length
  endOffset -= quote.length - quote.trimEnd().length
  quote = full.slice(startOffset, endOffset)
  if (!quote.trim()) return null

  return { startOffset, endOffset, quote }
}

/** Wrap [from, to) chars of a single text node in a `<mark>` for `id`. */
function wrapTextPortion(textNode: Text, from: number, to: number, id: HighlightAnchor['id']): void {
  let target = textNode
  if (from > 0) target = target.splitText(from)
  if (to - from < target.length) target.splitText(to - from)

  const mark = document.createElement('mark')
  mark.className = 'hl'
  mark.setAttribute('data-hl-id', String(id))
  target.parentNode?.insertBefore(mark, target)
  mark.appendChild(target)
}

/**
 * Paint a highlight onto `rootEl`. Prefers the stored offsets; if the text
 * there no longer matches `quote`, falls back to the first `indexOf(quote)`.
 * Returns false when the quote can no longer be located.
 */
export function paintHighlight(rootEl: HTMLElement, anchor: HighlightAnchor): boolean {
  const full = rootEl.textContent || ''
  let { startOffset, endOffset } = anchor
  const { quote, id } = anchor

  if (full.slice(startOffset, endOffset) !== quote) {
    const idx = full.indexOf(quote)
    if (idx < 0) return false
    startOffset = idx
    endOffset = idx + quote.length
  }

  // Collect overlapping segments first; splitText mutates the tree as we wrap.
  const segments: { node: Text; from: number; to: number }[] = []
  const walker = document.createTreeWalker(rootEl, NodeFilter.SHOW_TEXT)
  let pos = 0
  let node: Node | null
  while ((node = walker.nextNode())) {
    const text = node as Text
    const len = text.length
    const nodeStart = pos
    pos += len
    if (pos <= startOffset) continue
    if (nodeStart >= endOffset) break
    if (isInsideMark(text, rootEl)) continue
    const from = Math.max(0, startOffset - nodeStart)
    const to = Math.min(len, endOffset - nodeStart)
    if (to > from) segments.push({ node: text, from, to })
  }
  if (!segments.length) return false

  for (const seg of segments) wrapTextPortion(seg.node, seg.from, seg.to, id)
  return true
}

/** Unwrap every `<mark>` belonging to `id`, merging the freed text back. */
export function unpaint(rootEl: HTMLElement, id: HighlightAnchor['id']): void {
  const marks = rootEl.querySelectorAll(`mark.hl[data-hl-id="${id}"]`)
  marks.forEach((m) => {
    const parent = m.parentNode
    if (!parent) return
    while (m.firstChild) parent.insertBefore(m.firstChild, m)
    parent.removeChild(m)
    parent.normalize()
  })
}

/** Unwrap all highlight marks (e.g. before a full re-paint). */
export function clearHighlights(rootEl: HTMLElement): void {
  rootEl.querySelectorAll('mark.hl').forEach((m) => {
    const parent = m.parentNode
    if (!parent) return
    while (m.firstChild) parent.insertBefore(m.firstChild, m)
    parent.removeChild(m)
  })
  rootEl.normalize()
}
