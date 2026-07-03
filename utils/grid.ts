/**
 * grid.ts — pure logic for the grid survey view.
 *
 * No DOM, no Vue, no side effects. ArticleGrid drives the gesture resolution;
 * useArticles drives the pagination helpers.
 *
 * Verb semantics (grid view, matching the deck):
 *   left  → read  — card leaves the grid
 *   right → save  — card leaves the grid
 *   Vertical belongs to scrolling; elevate is deliberately deck-only.
 */

import type { Article } from '~/types'

/** Tunable gesture + paging constants, in one place (mirrors utils/deck.ts DECK). */
export const GRID = {
  /** Page size for infinite-scroll loads (server max is 200). */
  PAGE_SIZE: 24,
  /** Min horizontal distance (px) for a slow-drag commit — same as the deck
      now that phone cards are full-width rows. */
  DISTANCE_THRESHOLD: 110,
  /** Min horizontal velocity (px/s) for a flick commit (same as the deck). */
  VELOCITY_THRESHOLD: 600,
  /** Horizontal offset must beat vertical by this ratio or the release is a
      scroll, not a swipe. Stricter than the deck's 1.4 — the deck owns the
      whole gesture surface, while a grid cell shares it with the scroller,
      so anything steeper than ~27° off horizontal must never commit. */
  DOMINANCE_RATIO: 2,
  /** Load-ahead margin for the infinite-scroll sentinel observer. */
  SENTINEL_MARGIN: '600px 0px',
  /** Spring for the off-grid fling (same feel as the deck's fling). */
  FLING: { type: 'spring' as const, stiffness: 220, damping: 30 },
} as const

export type GridDirection = 'left' | 'right'

/**
 * Resolve a release (offset + velocity) into a commit direction, or null for
 * a spring-back. Mirrors utils/deck.ts resolveDirection with no vertical
 * verbs — but dy still matters: the drag is axis-locked to x visually, while
 * the POINTER may have moved diagonally, and a mostly-vertical gesture is a
 * scroll the cell should never steal (DOMINANCE_RATIO). A flick only counts
 * when its velocity points the same way as the offset.
 */
export function resolveGridDirection(dx: number, dy: number, vx: number): GridDirection | null {
  if (Math.abs(dx) < Math.abs(dy) * GRID.DOMINANCE_RATIO) return null
  const flick = Math.abs(vx) >= GRID.VELOCITY_THRESHOLD && Math.sign(vx) === Math.sign(dx)
  if (Math.abs(dx) >= GRID.DISTANCE_THRESHOLD || flick) return dx < 0 ? 'left' : 'right'
  return null
}

/**
 * Next-page offset into the server's unread-and-unsaved window.
 *
 * The list is fetched `isRead=false&excludeSaved=true`, ordered
 * `published_at DESC`. Locally marking a fetched article read (or saving it)
 * removes it from the server's window, so a naive `offset += limit` would
 * skip rows. If we've fetched k rows and m of them stopped matching, the
 * survivors occupy positions 0..k−m−1 of the new window — so the count of
 * fetched rows that STILL match is exactly the position of the first
 * unfetched row. `extraOffset` skips past a stale stretch after a page came
 * back all-duplicates (new arrivals shifted the window right under us).
 */
export function nextPageOffset(
  articles: readonly Pick<Article, 'id' | 'isRead'>[],
  savedIds: ReadonlySet<number>,
  extraOffset = 0,
): number {
  const stillMatching = articles.filter((a) => !a.isRead && !savedIds.has(a.id)).length
  return stillMatching + extraOffset
}

/**
 * Append a fetched page onto the existing list, dropping articles we already
 * hold (a shifted window can re-serve rows). Existing object references are
 * preserved so in-place reactivity (isRead flips, imageUrl backfills) keeps
 * working. Returns the merged list plus how many rows were genuinely new —
 * `added === 0` with `hasMore` still true means the window shifted a whole
 * page's worth and the caller should bump its extra offset.
 */
export function dedupeAppend(
  existing: readonly Article[],
  page: readonly Article[],
): { merged: Article[]; added: number } {
  const seen = new Set(existing.map((a) => a.id))
  const fresh = page.filter((a) => !seen.has(a.id))
  return { merged: [...existing, ...fresh], added: fresh.length }
}
