/**
 * readingPosition.ts — pure logic for keeping the reader's place in an
 * article. Position is a fraction of the scrollable height (0..1), stored
 * per article server-side (Article.read_progress) and restored on re-entry.
 */

/**
 * Restore only a place worth restoring: a barely-started article opens at
 * the top, and a finished one (the reader hit "Mark as read" at the bottom)
 * re-opens at the top for reference rather than at the tail end.
 */
export const RESTORE_MIN = 0.03
export const RESTORE_MAX = 0.95

/** Below this, a change in position isn't worth a network write. */
const SAVE_DELTA = 0.01

export function shouldRestorePosition(progress: number | null | undefined): boolean {
  return typeof progress === 'number' && progress >= RESTORE_MIN && progress <= RESTORE_MAX
}

/** Absolute scrollTop for a stored fraction, given the current page metrics. */
export function restoreScrollTop(
  progress: number,
  scrollHeight: number,
  viewportHeight: number
): number {
  const max = scrollHeight - viewportHeight
  if (max <= 0) return 0
  return Math.min(max, Math.max(0, progress * max))
}

/** Whether the position moved enough since the last save to persist again. */
export function progressWorthSaving(progress: number, lastSaved: number): boolean {
  return Math.abs(progress - lastSaved) >= SAVE_DELTA
}
