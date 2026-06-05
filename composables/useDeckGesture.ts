/**
 * useDeckGesture — card-scoped pointer/touch drag for the reading deck.
 *
 * Unlike `useSwipeGesture` (window-level, for prev/next nav), this composable
 * binds to a single card element. The top card follows the finger
 * (translateX/Y + a slight rotate proportional to dx) and reveals exactly one
 * action hint (STORE / READ / OPEN / SKIP) on the leading edge. On release
 * past threshold it calls `onCommit(direction)`, otherwise it springs back.
 *
 * An imperative `commit(direction)` is also exposed so keyboard shortcuts and
 * on-screen ActionLabels drive the same path with an animated fling.
 */

import { ref, computed, onUnmounted, type Ref } from 'vue'
import {
  resolveDirection,
  DECK_COMMIT_THRESHOLD,
  type DeckDirection,
} from '~/utils/deck'
import { SWIPE_CONFIG } from '~/composables/useSwipeGesture'

export interface UseDeckGestureOptions {
  /** Called when a gesture (or imperative commit) crosses the threshold. */
  onCommit: (direction: DeckDirection) => void
  /** Disable all interaction (e.g. while the deck is empty / animating). */
  disabled?: Ref<boolean>
  /** Override the commit threshold in px. Defaults to DECK_COMMIT_THRESHOLD. */
  threshold?: number
}

function isInteractiveElement(target: HTMLElement | null): boolean {
  if (!target) return false
  const interactiveTags = ['INPUT', 'TEXTAREA', 'BUTTON', 'A', 'SELECT']
  return (
    interactiveTags.includes(target.tagName) ||
    target.closest('button, a, input, textarea, select') !== null
  )
}

export function useDeckGesture(options: UseDeckGestureOptions) {
  const { onCommit, disabled } = options
  const threshold = options.threshold ?? DECK_COMMIT_THRESHOLD

  // Live drag offsets (px).
  const dx = ref(0)
  const dy = ref(0)
  const dragging = ref(false)
  const animating = ref(false)

  let startX = 0
  let startY = 0
  let pointerId: number | null = null
  let el: HTMLElement | null = null

  /** The direction the current drag is leaning toward (or null). */
  const direction = computed<DeckDirection | null>(() =>
    resolveDirection(dx.value, dy.value, SWIPE_CONFIG.MIN_SWIPE_DETECTION),
  )

  /** 0..1 progress toward the commit threshold along the dominant axis. */
  const progress = computed(() => {
    const dominant = Math.max(Math.abs(dx.value), Math.abs(dy.value))
    return Math.min(dominant / threshold, 1)
  })

  /** Slight rotation proportional to horizontal drag (capped). */
  const rotation = computed(() => {
    const r = (dx.value / SWIPE_CONFIG.MAX_DISTANCE) * 8 // up to ~8deg
    return Math.max(-8, Math.min(8, r))
  })

  /** Inline style for the top card — bind to the dragged element. */
  const cardStyle = computed(() => {
    const transition = dragging.value
      ? 'none'
      : 'transform 220ms cubic-bezier(0.22, 1, 0.36, 1)'
    return {
      transform: `translate(${dx.value}px, ${dy.value}px) rotate(${rotation.value}deg)`,
      transition,
      willChange: 'transform',
      touchAction: 'none' as const,
    }
  })

  /** Opacity (0..1) of a given direction's action hint during drag. */
  function hintOpacity(dir: DeckDirection): number {
    if (direction.value !== dir) return 0
    return progress.value
  }

  function reset() {
    dx.value = 0
    dy.value = 0
  }

  function endDrag() {
    if (!dragging.value) return
    dragging.value = false

    const dir = resolveDirection(dx.value, dy.value, threshold)
    if (dir) {
      // Past threshold → commit. Fling the card out, then notify.
      flingOut(dir)
    } else {
      // Spring back.
      reset()
    }
  }

  function flingOut(dir: DeckDirection) {
    // `up` opens the reader without removing the card — keep it in place.
    if (dir === 'up') {
      reset()
      onCommit(dir)
      return
    }

    animating.value = true
    const off = SWIPE_CONFIG.MAX_DISTANCE * 2
    switch (dir) {
      case 'left':
        dx.value = -off
        break
      case 'right':
        dx.value = off
        break
      case 'down':
        dy.value = off
        break
    }

    window.setTimeout(() => {
      animating.value = false
      reset()
      onCommit(dir)
    }, 200)
  }

  // ---- Pointer handlers (element-scoped) --------------------------------

  function onPointerDown(e: PointerEvent) {
    if (disabled?.value || animating.value) return
    if (isInteractiveElement(e.target as HTMLElement)) return

    el = e.currentTarget as HTMLElement
    pointerId = e.pointerId
    startX = e.clientX
    startY = e.clientY
    dragging.value = true
    reset()
    try {
      el.setPointerCapture(e.pointerId)
    } catch {
      /* setPointerCapture may throw in some test envs — safe to ignore */
    }
  }

  function onPointerMove(e: PointerEvent) {
    if (!dragging.value || e.pointerId !== pointerId) return
    dx.value = e.clientX - startX
    dy.value = e.clientY - startY
  }

  function onPointerUp(e: PointerEvent) {
    if (e.pointerId !== pointerId) return
    try {
      el?.releasePointerCapture(e.pointerId)
    } catch {
      /* ignore */
    }
    pointerId = null
    endDrag()
  }

  function onPointerCancel() {
    pointerId = null
    dragging.value = false
    reset()
  }

  /** Bind these to the top card element via v-on. */
  const handlers = {
    onPointerdown: onPointerDown,
    onPointermove: onPointerMove,
    onPointerup: onPointerUp,
    onPointercancel: onPointerCancel,
    onPointerleave: onPointerUp,
  }

  /**
   * Imperative commit — used by keyboard shortcuts and ActionLabels so they
   * animate identically to a drag-release.
   */
  function commit(dir: DeckDirection) {
    if (disabled?.value || animating.value) return
    dragging.value = false
    flingOut(dir)
  }

  onUnmounted(() => {
    pointerId = null
    dragging.value = false
  })

  return {
    // state
    dx,
    dy,
    dragging,
    animating,
    direction,
    progress,
    rotation,
    // derived
    cardStyle,
    hintOpacity,
    // binding + imperative
    handlers,
    commit,
  }
}
