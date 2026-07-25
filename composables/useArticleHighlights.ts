import type { Ref } from 'vue'
import {
  getSelectionOffsets, paintHighlight, unpaint, clearHighlights,
} from '~/utils/highlightDom'
import type { Highlight } from '~/composables/useHighlights'

export interface PendingSelection {
  startOffset: number
  endOffset: number
  quote: string
}

/** Where to draw the floating `— HIGHLIGHT` pill. */
export interface PillPosition {
  side: 'bottom' | 'below'
  x: number
  y: number
}

/**
 * The yellow pen, for one article.
 *
 * Per-instance state (plain refs, not `useState`) — a highlight set belongs to
 * the open article, not to the app. The reader page mounts fresh per article
 * (`definePageMeta({ key })`), so this is created and torn down with it.
 *
 * Anchoring is plain-text offsets into the rendered body plus the exact quote
 * string; the DOM work lives in `utils/highlightDom.ts` (pure, jsdom-tested).
 * Saving is deliberately **non-optimistic** — the mark is painted only once the
 * server hands back an id.
 */
export function useArticleHighlights(articleId: number, articleEl: Ref<HTMLElement | null>) {
  const { fetchHighlights, createHighlight, deleteHighlight } = useHighlights()
  const { showSuccess, showError } = useToast()

  const highlights = ref<Highlight[]>([])
  const pendingSel = ref<PendingSelection | null>(null)
  const pill = ref<PillPosition | null>(null)
  const noteOverlay = ref<{ quote: string } | null>(null)
  const savingNote = ref(false)
  const popover = ref<{ highlight: Highlight; x: number; y: number } | null>(null)

  /** Re-paint every stored highlight onto the (re-rendered) article body. */
  function repaintHighlights() {
    const el = articleEl.value
    if (!el) return
    clearHighlights(el)
    for (const h of highlights.value) {
      paintHighlight(el, { id: h.id, startOffset: h.startOffset, endOffset: h.endOffset, quote: h.quote })
    }
  }

  async function loadHighlights() {
    highlights.value = await fetchHighlights(articleId).catch(() => [])
    await nextTick()
    repaintHighlights()
  }

  function onSelect() {
    const el = articleEl.value
    if (!el || noteOverlay.value || popover.value) return
    const offsets = getSelectionOffsets(el)
    if (!offsets) { pill.value = null; pendingSel.value = null; return }
    pendingSel.value = offsets
    const rect = window.getSelection()?.getRangeAt(0).getBoundingClientRect()
    if (rect && rect.width) {
      if (window.matchMedia('(pointer: coarse)').matches) {
        // Touch: a fixed pill low on the screen — never positioned relative to
        // the selection, because touches on selected text belong to the OS
        // (selection handles + callout sit above all web content).
        pill.value = { side: 'bottom', x: 0, y: 0 }
      } else {
        // Mouse: below the selection center. Clamp so a selection ending at
        // the bottom of the viewport keeps the pill on-screen.
        pill.value = {
          side: 'below',
          x: rect.left + rect.width / 2,
          y: Math.min(rect.bottom, window.innerHeight - 64),
        }
      }
    }
  }

  function startHighlight() {
    if (!pendingSel.value) return
    noteOverlay.value = { quote: pendingSel.value.quote }
    pill.value = null
  }

  async function saveHighlight(note: string) {
    const sel = pendingSel.value
    if (!sel || savingNote.value) return
    savingNote.value = true
    try {
      const h = await createHighlight(articleId, {
        quote: sel.quote, note, startOffset: sel.startOffset, endOffset: sel.endOffset,
      })
      highlights.value = [...highlights.value, h]
      await nextTick()
      if (articleEl.value) {
        paintHighlight(articleEl.value, {
          id: h.id, startOffset: h.startOffset, endOffset: h.endOffset, quote: h.quote,
        })
      }
      showSuccess('Highlighted')
      noteOverlay.value = null
      pendingSel.value = null
      window.getSelection()?.removeAllRanges()
    } catch {
      showError('Could not save the highlight')
    } finally {
      savingNote.value = false
    }
  }

  function onArticleClick(e: MouseEvent) {
    const mark = (e.target as HTMLElement)?.closest?.('[data-hl-id]')
    if (!mark) return
    const hid = Number(mark.getAttribute('data-hl-id'))
    const h = highlights.value.find((x) => x.id === hid)
    if (!h) return
    e.preventDefault()
    const rect = mark.getBoundingClientRect()
    popover.value = { highlight: h, x: rect.left, y: rect.bottom }
  }

  async function removeHighlight() {
    const h = popover.value?.highlight
    if (!h) return
    try {
      await deleteHighlight(h.id)
      highlights.value = highlights.value.filter((x) => x.id !== h.id)
      if (articleEl.value) unpaint(articleEl.value, h.id)
      showSuccess('Removed')
    } catch {
      showError('Could not remove the highlight')
    } finally {
      popover.value = null
    }
  }

  return {
    highlights,
    pendingSel,
    pill,
    noteOverlay,
    savingNote,
    popover,
    repaintHighlights,
    loadHighlights,
    onSelect,
    startHighlight,
    saveHighlight,
    onArticleClick,
    removeHighlight,
  }
}
