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
 * The article to read next after `currentId`, inside the deck context the
 * list was fetched for (home, tag, or feed scope — whatever useArticles last
 * loaded). Scans forward from the current article, wrapping to the top —
 * cards earlier in the list can still be unread (scrolled or skipped past).
 * Read and saved articles are passed over (they've left the deck). Returns
 * null when the current article isn't in the list at all (opened from the
 * shelf, search, or a deep link — there is no deck context to continue in)
 * or when nothing unread remains.
 */
export function nextUnreadId(
  articles: readonly Pick<Article, 'id' | 'isRead'>[],
  savedIds: ReadonlySet<number>,
  currentId: number,
): number | null {
  const idx = articles.findIndex((a) => a.id === currentId)
  if (idx === -1) return null
  for (let step = 1; step < articles.length; step++) {
    const a = articles[(idx + step) % articles.length]
    if (!a.isRead && !savedIds.has(a.id)) return a.id
  }
  return null
}

/**
 * The article before `currentId` in the deck context — nextUnreadId's mirror
 * (`k` in the reader). Scans backward from the current article, wrapping past
 * the top, passing over read and saved rows. Same null cases: current article
 * not in the list, or nothing unread besides it.
 */
export function prevUnreadId(
  articles: readonly Pick<Article, 'id' | 'isRead'>[],
  savedIds: ReadonlySet<number>,
  currentId: number,
): number | null {
  const idx = articles.findIndex((a) => a.id === currentId)
  if (idx === -1) return null
  for (let step = 1; step < articles.length; step++) {
    const a = articles[(idx - step + articles.length) % articles.length]
    if (!a.isRead && !savedIds.has(a.id)) return a.id
  }
  return null
}

/**
 * Reconcile the grid's stable slot order with the live article pool.
 *
 * The grid displays a slot list, not the pool directly: swiping a card away
 * must not reflow the survey, so slot positions are stable and only the
 * committed slot changes. This keeps the two in sync — slots whose article
 * left the pool (committed, saved elsewhere, synced away) are dropped, and
 * pool articles not yet slotted (a loadMore page, a sync's new arrivals, an
 * undone card re-entering) are appended at the END, where nothing shifts.
 */
export function syncSlots(slotIds: readonly number[], poolIds: readonly number[]): number[] {
  const pool = new Set(poolIds)
  const kept = slotIds.filter((id) => pool.has(id))
  const slotted = new Set(kept)
  return [...kept, ...poolIds.filter((id) => !slotted.has(id))]
}

/**
 * Remove a committed card from the slot list by pulling the LAST slot — the
 * article furthest down the feed — into the vacated position. Every other
 * card keeps its place; chronology bends at exactly one slot (deliberate —
 * calm beats strict order in a survey view). Committing the last slot just
 * shortens the list. Returns the new slots plus which id moved (null when
 * none did), so undo can put both back.
 */
export function backfillSlot(
  slotIds: readonly number[],
  removedId: number,
): { slots: number[]; movedId: number | null } {
  const i = slotIds.indexOf(removedId)
  if (i === -1) return { slots: [...slotIds], movedId: null }
  const slots = [...slotIds]
  const movedId = i === slots.length - 1 ? null : slots[slots.length - 1]
  slots.pop()
  if (movedId != null) slots[i] = movedId
  return { slots, movedId }
}

/**
 * backfillSlot's inverse, for undo: the undone card returns to its original
 * slot and the card that backfilled it goes back to the end. Tolerates drift
 * since the commit — a backfill card that has itself been committed is simply
 * gone, and an out-of-range index clamps to the end.
 */
export function restoreSlot(
  slotIds: readonly number[],
  id: number,
  index: number,
  movedId: number | null,
): number[] {
  let slots = slotIds.filter((s) => s !== id)
  const returnMoved = movedId != null && slots.includes(movedId)
  if (returnMoved) slots = slots.filter((s) => s !== movedId)
  const i = Math.min(Math.max(index, 0), slots.length)
  return [...slots.slice(0, i), id, ...slots.slice(i), ...(returnMoved ? [movedId!] : [])]
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
