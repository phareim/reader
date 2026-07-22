/**
 * readerSwipe.ts — pure gesture logic for swiping the open article away.
 *
 * Swipe left in the reader = mark read and continue to the next unread (the
 * touch analog of the `r` key). Deliberately pickier than the deck/grid
 * resolvers: the reader is primarily a vertical scroller full of selectable
 * text and links, so a commit demands a longer, faster, more decisively
 * horizontal gesture — and never one that starts at a screen edge, where the
 * browser's own back/forward navigation swipes live.
 */

export const READER_SWIPE = {
  /** Min horizontal distance (px) for a slow-drag commit — well past the
      deck's 110: the full page has the room, and accidental drags don't. */
  DISTANCE_THRESHOLD: 150,
  /** Min horizontal velocity (px/s) for a flick commit (deck is 600). */
  VELOCITY_THRESHOLD: 800,
  /** Horizontal offset must beat vertical by this ratio — stricter than the
      grid's 2: anything steeper than ~18° off horizontal is a scroll. */
  DOMINANCE_RATIO: 3,
  /** Gestures starting within this many px of either screen edge belong to
      the browser's back/forward navigation swipes — never to us. */
  EDGE_GUARD: 32,
} as const

/**
 * Resolve a release into "swipe the article away" (true) or nothing (false).
 * Only leftward commits — rightward has no verb in the reader. A flick only
 * counts when its velocity points the same way as the offset.
 */
export function resolveReaderSwipe(
  dx: number,
  dy: number,
  vx: number,
  startX: number,
  viewportWidth: number,
): boolean {
  if (startX < READER_SWIPE.EDGE_GUARD || startX > viewportWidth - READER_SWIPE.EDGE_GUARD) {
    return false
  }
  if (dx >= 0) return false
  if (Math.abs(dx) < Math.abs(dy) * READER_SWIPE.DOMINANCE_RATIO) return false
  const flick = vx <= -READER_SWIPE.VELOCITY_THRESHOLD
  return Math.abs(dx) >= READER_SWIPE.DISTANCE_THRESHOLD || flick
}

/**
 * Pending-verb progress (0..1) for the accent label while dragging. Mirrors
 * the commit rule's direction + dominance gates so the label never lights up
 * for a drag that could not commit.
 */
export function readerSwipeProgress(dx: number, dy: number): number {
  if (dx > -4) return 0
  if (Math.abs(dx) < Math.abs(dy) * READER_SWIPE.DOMINANCE_RATIO) return 0
  return Math.min(1, Math.abs(dx) / READER_SWIPE.DISTANCE_THRESHOLD)
}
