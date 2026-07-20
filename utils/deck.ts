/**
 * deck.ts — pure deck state machine for the card-stack entrance.
 *
 * No DOM, no Vue, no side effects. The CardStack component drives these
 * reducers; motion-v owns the rendering physics.
 *
 * Direction semantics (spec §3, left/right swapped 2026-07-03):
 *   left  → read     — removes the top card
 *   right → save     — removes the top card
 *   up    → elevate  — removes the top card (SFL promotion)
 *   down  → skip     — rotates the top card to the back
 */

export type DeckDirection = 'left' | 'right' | 'up' | 'down'

/** Tunable physics + commit constants, in one place (spec §3). */
export const DECK = {
  /** Min dominant-axis distance (px) for a slow-drag commit. */
  DISTANCE_THRESHOLD: 110,
  /** Min dominant-axis velocity (px/s) for a flick commit. */
  VELOCITY_THRESHOLD: 600,
  /** Dominant axis must beat the other by this ratio, else ambiguous. */
  DOMINANCE_RATIO: 1.4,
  /** Card rotation at full horizontal drag, degrees. */
  MAX_ROTATION: 9,
  /** Spring for snap-back and stack promotion. */
  SPRING: { type: 'spring' as const, stiffness: 500, damping: 36 },
  /** Spring for the off-screen fling. */
  FLING: { type: 'spring' as const, stiffness: 320, damping: 36 },
} as const

export interface DeckHistoryEntry {
  id: string
  action: DeckDirection
  prevIndex: number
  /** SFL idea id, recorded on elevate so undo can delete it. */
  ideaId?: string
  /** True when SFL reported the idea already existed (undo must NOT delete). */
  ideaExisting?: boolean
}

/**
 * Resolve a release (offset + velocity) into a commit direction, or null for
 * a spring-back. A commit happens on EITHER sufficient distance OR a flick —
 * but a flick only counts when its velocity points the same way as the
 * offset (flicking back toward origin must not commit).
 */
export function resolveDirection(
  dx: number,
  dy: number,
  vx: number,
  vy: number,
): DeckDirection | null {
  const absX = Math.abs(dx)
  const absY = Math.abs(dy)

  const horizontalDominant = absX >= absY * DECK.DOMINANCE_RATIO
  const verticalDominant = absY >= absX * DECK.DOMINANCE_RATIO

  if (horizontalDominant) {
    const flick = Math.abs(vx) >= DECK.VELOCITY_THRESHOLD && Math.sign(vx) === Math.sign(dx)
    if (absX >= DECK.DISTANCE_THRESHOLD || flick) return dx < 0 ? 'left' : 'right'
    return null
  }

  if (verticalDominant) {
    const flick = Math.abs(vy) >= DECK.VELOCITY_THRESHOLD && Math.sign(vy) === Math.sign(dy)
    if (absY >= DECK.DISTANCE_THRESHOLD || flick) return dy < 0 ? 'up' : 'down'
    return null
  }

  return null
}

/**
 * Apply a committed direction to the deck. Returns a NEW deck plus the
 * history entry to record (null entry when the deck was empty).
 */
export function advance(
  deck: readonly string[],
  action: DeckDirection,
): { deck: string[]; entry: DeckHistoryEntry | null } {
  if (deck.length === 0) return { deck: [], entry: null }

  const [top, ...rest] = deck
  const entry: DeckHistoryEntry = { id: top, action, prevIndex: 0 }

  if (action === 'down') return { deck: [...rest, top], entry }
  return { deck: rest, entry }
}

/**
 * Undo the most recent entry: the card returns to the top of the deck (for
 * skips the back-copy is removed first so it never appears twice). Callers
 * reverse the corresponding API effect using the returned entry.
 */
export function undo(
  deck: readonly string[],
  history: readonly DeckHistoryEntry[],
): { deck: string[]; history: DeckHistoryEntry[]; entry: DeckHistoryEntry } | null {
  if (history.length === 0) return null

  const entry = history[history.length - 1]
  const without = deck.filter((id) => id !== entry.id)
  return {
    deck: [entry.id, ...without],
    history: history.slice(0, -1),
    entry,
  }
}
