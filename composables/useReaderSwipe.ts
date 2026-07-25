import type { Ref } from 'vue'
import { useMotionValue, useTransform, animate } from 'motion-v'
import type { PanInfo } from 'motion-v'
import { DECK } from '~/utils/deck'
import { READER_SWIPE, resolveReaderSwipe, readerSwipeProgress } from '~/utils/readerSwipe'
import { settleWithin } from '~/utils/settleWithin'

/**
 * The reader's swipe-away gesture: on touch, a decisive left swipe flings the
 * whole article off-screen with the deck's card physics.
 *
 * The commit rule is the deliberately picky `utils/readerSwipe.ts` (pure +
 * unit-tested) — 150px distance, 800px/s flick, 3:1 horizontal dominance so
 * anything resembling a scroll never commits, plus an edge guard rejecting
 * gestures that start where the browser's own back/forward swipes live. A
 * non-commit release is sprung home by `drag-snap-to-origin`.
 *
 * Coarse-pointer only: a mouse drag over prose is a text selection, never a
 * verb. The caller supplies `enabled` for everything else that can own the
 * gesture space (an overlay, the voice player, a live text selection).
 */
export function useReaderSwipe(opts: {
  /** Page-owned gate — false while another surface owns the gesture space. */
  enabled: Ref<boolean>
  /** Runs on a committed swipe. Usually calls back into `fling()`. */
  onCommit: (velocityX: number) => void | Promise<void>
}) {
  const swipeX = useMotionValue(0)
  const swipeOpacity = useTransform(swipeX, [-500, 0], [0.55, 1])
  const swipeProgress = ref(0)
  const swipeExiting = ref(false)
  const coarsePointer = ref(false)

  let swipeStartX = 0
  let swipeMoved = false

  const dragEnabled = computed(() =>
    coarsePointer.value && !swipeExiting.value && opts.enabled.value
  )

  onMounted(() => {
    coarsePointer.value = window.matchMedia('(pointer: coarse)').matches
  })

  function onSwipePointerDown(e: PointerEvent) {
    swipeStartX = e.clientX
    swipeMoved = false
  }

  function onSwipeDrag(info: PanInfo) {
    if (Math.abs(info.offset.x) > 8) swipeMoved = true
    const edgeGuarded =
      swipeStartX < READER_SWIPE.EDGE_GUARD ||
      swipeStartX > window.innerWidth - READER_SWIPE.EDGE_GUARD
    swipeProgress.value = edgeGuarded ? 0 : readerSwipeProgress(info.offset.x, info.offset.y)
  }

  async function onSwipeDragEnd(info: PanInfo) {
    swipeProgress.value = 0
    // Defer the tap-guard reset so the click event (which fires after dragEnd)
    // still sees swipeMoved=true and is swallowed — a drag released over a link
    // must not follow it.
    setTimeout(() => { swipeMoved = false }, 0)
    if (!resolveReaderSwipe(
      info.offset.x, info.offset.y, info.velocity.x, swipeStartX, window.innerWidth,
    )) return
    await opts.onCommit(info.velocity.x)
  }

  function onSwipeClickCapture(e: MouseEvent) {
    if (swipeMoved) { e.preventDefault(); e.stopPropagation() }
  }

  /**
   * Fling the article off-screen left and resolve once it has settled (or the
   * animation safety timeout fires). Marks the gesture as exiting, so a second
   * call is a no-op — check `swipeExiting` before starting side effects.
   */
  async function fling(velocityX = 0) {
    swipeExiting.value = true
    await settleWithin(
      animate(swipeX, -window.innerWidth * 1.1, { ...DECK.FLING, velocity: velocityX })
    )
  }

  return {
    swipeX,
    swipeOpacity,
    swipeProgress,
    swipeExiting,
    coarsePointer,
    dragEnabled,
    onSwipePointerDown,
    onSwipeDrag,
    onSwipeDragEnd,
    onSwipeClickCapture,
    fling,
  }
}
