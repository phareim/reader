import { paintHighlight, unpaint, clearHighlights } from '~/utils/highlightDom'

function makeArticle(html: string): HTMLElement {
  const el = document.createElement('article')
  el.innerHTML = html
  document.body.appendChild(el)
  return el
}

afterEach(() => { document.body.innerHTML = '' })

/** Offsets into an element's textContent for a substring (test helper). */
function offsetsOf(el: HTMLElement, sub: string) {
  const full = el.textContent || ''
  const start = full.indexOf(sub)
  return { start, end: start + sub.length }
}

describe('paintHighlight', () => {
  it('wraps an exact offset range within one text node', () => {
    const el = makeArticle('<p>The quick brown fox</p>')
    const { start, end } = offsetsOf(el, 'quick brown')
    const ok = paintHighlight(el, { id: 1, startOffset: start, endOffset: end, quote: 'quick brown' })

    expect(ok).toBe(true)
    const mark = el.querySelector('mark.hl[data-hl-id="1"]')
    expect(mark?.textContent).toBe('quick brown')
    // The surrounding text is preserved.
    expect(el.textContent).toBe('The quick brown fox')
  })

  it('spans across element boundaries, painting each text node segment', () => {
    const el = makeArticle('<p>foo <strong>bar</strong> baz</p>')
    const { start, end } = offsetsOf(el, 'oo bar ba')
    const ok = paintHighlight(el, { id: 7, startOffset: start, endOffset: end, quote: 'oo bar ba' })

    expect(ok).toBe(true)
    const marks = el.querySelectorAll('mark.hl[data-hl-id="7"]')
    expect(marks.length).toBeGreaterThan(1)
    const combined = Array.from(marks).map((m) => m.textContent).join('')
    expect(combined).toBe('oo bar ba')
    // The <strong> is still inside the painted range.
    expect(el.querySelector('strong')).not.toBeNull()
  })

  it('falls back to indexOf(quote) when the stored offsets no longer match', () => {
    const el = makeArticle('<p>alpha beta gamma</p>')
    // Deliberately wrong offsets; the quote is still locatable.
    const ok = paintHighlight(el, { id: 2, startOffset: 999, endOffset: 1004, quote: 'beta' })

    expect(ok).toBe(true)
    expect(el.querySelector('mark.hl[data-hl-id="2"]')?.textContent).toBe('beta')
  })

  it('returns false when the quote cannot be located at all', () => {
    const el = makeArticle('<p>nothing to see</p>')
    const ok = paintHighlight(el, { id: 3, startOffset: 0, endOffset: 4, quote: 'absent' })
    expect(ok).toBe(false)
    expect(el.querySelector('mark.hl')).toBeNull()
  })
})

describe('unpaint / clearHighlights', () => {
  it('unpaint removes one highlight and restores the text', () => {
    const el = makeArticle('<p>one two three</p>')
    const a = offsetsOf(el, 'one')
    const b = offsetsOf(el, 'three')
    paintHighlight(el, { id: 1, startOffset: a.start, endOffset: a.end, quote: 'one' })
    paintHighlight(el, { id: 2, startOffset: b.start, endOffset: b.end, quote: 'three' })

    unpaint(el, 1)
    expect(el.querySelector('mark.hl[data-hl-id="1"]')).toBeNull()
    expect(el.querySelector('mark.hl[data-hl-id="2"]')).not.toBeNull()
    expect(el.textContent).toBe('one two three')
  })

  it('clearHighlights removes every mark', () => {
    const el = makeArticle('<p>one two three</p>')
    const a = offsetsOf(el, 'one')
    const b = offsetsOf(el, 'three')
    paintHighlight(el, { id: 1, startOffset: a.start, endOffset: a.end, quote: 'one' })
    paintHighlight(el, { id: 2, startOffset: b.start, endOffset: b.end, quote: 'three' })

    clearHighlights(el)
    expect(el.querySelectorAll('mark.hl').length).toBe(0)
    expect(el.textContent).toBe('one two three')
  })

  it('a paint → clear → re-paint cycle is stable', () => {
    const el = makeArticle('<p>The quick brown fox</p>')
    const { start, end } = offsetsOf(el, 'brown')
    const anchor = { id: 9, startOffset: start, endOffset: end, quote: 'brown' }

    paintHighlight(el, anchor)
    clearHighlights(el)
    const ok = paintHighlight(el, anchor)
    expect(ok).toBe(true)
    expect(el.querySelector('mark.hl[data-hl-id="9"]')?.textContent).toBe('brown')
  })
})
