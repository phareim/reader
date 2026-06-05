/**
 * deck.ts — pure deck state machine for the card-stack reading entrance.
 *
 * No DOM, no Vue, no side effects: everything here is a pure function over
 * plain data so it can be unit-tested in isolation. The composable
 * `useDeckGesture` and the CardStack component drive these reducers.
 *
 * Direction semantics (matches spec §2):
 *   left  → store   (save)        — removes the top card
 *   right → read    (mark read)   — removes the top card
 *   up    → open    (reader)      — non-destructive (no deck mutation here)
 *   down  → skip                  — moves the top card to the back of the deck
 */

import { SWIPE_CONFIG } from '~/composables/useSwipeGesture'

export type DeckDirection = 'left' | 'right' | 'up' | 'down'

/** A committed action against the top card of the deck. */
export type DeckAction = DeckDirection | 'commit' | 'skip'

export interface DeckHistoryEntry {
  /** The article id the action was applied to. */
  id: string
  /** The action taken. */
  action: DeckAction
  /** The index the id occupied before the action (for restore on undo). */
  prevIndex: number
}

/**
 * Resolve a pointer delta into a cardinal swipe direction, or null if the
 * gesture is too small / too ambiguous to count.
 *
 * `threshold` is the minimum dominant-axis distance (in px) required to
 * commit. The dominant axis must also beat the other axis by the configured
 * dominance ratio, otherwise the gesture is ambiguous and we return null.
 */
export function resolveDirection(
  dx: number,
  dy: number,
  threshold: number,
): DeckDirection | null {
  const absX = Math.abs(dx)
  const absY = Math.abs(dy)

  const horizontalDominant = absX >= absY * SWIPE_CONFIG.HORIZONTAL_DOMINANCE_RATIO
  const verticalDominant = absY >= absX * SWIPE_CONFIG.HORIZONTAL_DOMINANCE_RATIO

  if (horizontalDominant) {
    if (absX < threshold) return null
    return dx < 0 ? 'left' : 'right'
  }

  if (verticalDominant) {
    if (absY < threshold) return null
    return dy < 0 ? 'up' : 'down'
  }

  // Neither axis clearly dominates → ambiguous, no direction.
  return null
}

/**
 * Default commit threshold in px, derived from the shared SWIPE_CONFIG so the
 * deck and the existing nav-swipe feel consistent.
 */
export const DECK_COMMIT_THRESHOLD =
  SWIPE_CONFIG.MAX_DISTANCE * SWIPE_CONFIG.MIN_DISTANCE_RATIO

/**
 * Advance the deck by applying `action` to the top card.
 *
 * - `down` / `skip`  → the top id is rotated to the BACK of the deck.
 * - `left` / `right` / `commit` → the top id is REMOVED from the deck.
 * - `up` is non-destructive: the deck is returned unchanged (opening the
 *   reader does not mutate the deck).
 *
 * Returns a NEW deck array plus the history entry to record (or null when the
 * deck was empty / the action was a no-op).
 */
export function advance(
  deck: readonly string[],
  action: DeckAction,
): { deck: string[]; entry: DeckHistoryEntry | null } {
  if (deck.length === 0) {
    return { deck: [...deck], entry: null }
  }

  const [top, ...rest] = deck
  const entry: DeckHistoryEntry = { id: top, action, prevIndex: 0 }

  // Opening the reader does not change the deck.
  if (action === 'up') {
    return { deck: [...deck], entry: null }
  }

  // Skip: rotate the top card to the back.
  if (action === 'down' || action === 'skip') {
    return { deck: [...rest, top], entry }
  }

  // Commit (store/read): remove the top card.
  return { deck: rest, entry }
}

/**
 * Undo the most recent history entry, restoring the affected id to the top of
 * the deck. Works for both removals (left/right/commit) and skips (down) —
 * in every case the card returns to the front so the user re-sees it.
 *
 * Returns the rebuilt deck and the popped entry (so callers can reverse the
 * corresponding API call), or null when there is nothing to undo.
 */
export function undo(
  deck: readonly string[],
  history: readonly DeckHistoryEntry[],
): { deck: string[]; history: DeckHistoryEntry[]; entry: DeckHistoryEntry } | null {
  if (history.length === 0) return null

  const entry = history[history.length - 1]
  const nextHistory = history.slice(0, -1)

  // Remove any existing copy of the id (a skip leaves it at the back) before
  // restoring it to the front, so it never appears twice.
  const without = deck.filter((id) => id !== entry.id)
  const nextDeck = [entry.id, ...without]

  return { deck: nextDeck, history: nextHistory, entry }
}
