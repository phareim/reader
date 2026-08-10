import { GRID, resolveGridDirection, nextPageOffset, nextUnreadId, prevUnreadId, dedupeAppend, syncSlots, backfillSlot, restoreSlot } from '~/utils/grid'
import type { Article } from '~/types'

describe('resolveGridDirection', () => {
  it('commits on sufficient leftward distance', () => {
    expect(resolveGridDirection(-GRID.DISTANCE_THRESHOLD, 0, 0)).toBe('left')
    expect(resolveGridDirection(-200, 0, 0)).toBe('left')
  })

  it('commits on sufficient rightward distance', () => {
    expect(resolveGridDirection(GRID.DISTANCE_THRESHOLD, 0, 0)).toBe('right')
  })

  it('returns null under the distance threshold with no flick', () => {
    expect(resolveGridDirection(-(GRID.DISTANCE_THRESHOLD - 1), 0, 0)).toBeNull()
    expect(resolveGridDirection(30, 0, 100)).toBeNull()
  })

  it('commits on a same-direction flick even under the distance threshold', () => {
    expect(resolveGridDirection(-20, 0, -GRID.VELOCITY_THRESHOLD)).toBe('left')
    expect(resolveGridDirection(20, 0, GRID.VELOCITY_THRESHOLD + 50)).toBe('right')
  })

  it('rejects a flick pointing back toward origin', () => {
    // Dragged right, flicked hard left — must not commit.
    expect(resolveGridDirection(40, 0, -900)).toBeNull()
    expect(resolveGridDirection(-40, 0, 900)).toBeNull()
  })

  it('rejects a diagonal release — vertical too big for the dominance ratio', () => {
    // 200px left but 150px down: a scroll that drifted, not a swipe.
    expect(resolveGridDirection(-200, 150, 0)).toBeNull()
    expect(resolveGridDirection(200, -150, 0)).toBeNull()
  })

  it('rejects a flick when the pointer moved mostly vertically', () => {
    expect(resolveGridDirection(-40, 60, -900)).toBeNull()
  })

  it('commits when horizontal beats vertical by the dominance ratio', () => {
    expect(resolveGridDirection(-GRID.DISTANCE_THRESHOLD * 2, GRID.DISTANCE_THRESHOLD, 0)).toBe('left')
  })

  it('zero movement resolves to null', () => {
    expect(resolveGridDirection(0, 0, 0)).toBeNull()
  })
})

const row = (id: number, isRead = false) => ({ id, isRead })

describe('nextPageOffset', () => {
  it('all fetched rows still unread and unsaved → offset = count', () => {
    expect(nextPageOffset([row(1), row(2), row(3)], new Set())).toBe(3)
  })

  it('locally-read rows no longer count toward the offset', () => {
    expect(nextPageOffset([row(1, true), row(2), row(3, true)], new Set())).toBe(1)
  })

  it('locally-saved rows no longer count toward the offset', () => {
    expect(nextPageOffset([row(1), row(2), row(3)], new Set([2, 3]))).toBe(1)
  })

  it('read AND saved rows are not double-subtracted', () => {
    expect(nextPageOffset([row(1, true), row(2)], new Set([1]))).toBe(1)
  })

  it('extraOffset is added on top', () => {
    expect(nextPageOffset([row(1), row(2)], new Set(), 24)).toBe(26)
  })

  it('empty list with no extra → 0', () => {
    expect(nextPageOffset([], new Set())).toBe(0)
  })
})

const article = (id: number) => ({ id, title: `A${id}` } as unknown as Article)

describe('dedupeAppend', () => {
  it('appends fresh rows and counts them', () => {
    const existing = [article(1), article(2)]
    const { merged, added } = dedupeAppend(existing, [article(3), article(4)])
    expect(merged.map((a) => a.id)).toEqual([1, 2, 3, 4])
    expect(added).toBe(2)
  })

  it('drops rows already present, preserving existing references and order', () => {
    const existing = [article(1), article(2)]
    const { merged, added } = dedupeAppend(existing, [article(2), article(3)])
    expect(merged.map((a) => a.id)).toEqual([1, 2, 3])
    expect(merged[1]).toBe(existing[1]) // original reference kept, not the page copy
    expect(added).toBe(1)
  })

  it('an all-duplicate page reports added = 0 and leaves the list unchanged', () => {
    const existing = [article(1), article(2)]
    const { merged, added } = dedupeAppend(existing, [article(1), article(2)])
    expect(merged.map((a) => a.id)).toEqual([1, 2])
    expect(added).toBe(0)
  })

  it('an empty page is a no-op', () => {
    const existing = [article(1)]
    const { merged, added } = dedupeAppend(existing, [])
    expect(merged.map((a) => a.id)).toEqual([1])
    expect(added).toBe(0)
  })
})

describe('nextUnreadId', () => {
  it('returns the next unread article after the current one', () => {
    expect(nextUnreadId([row(1, true), row(2), row(3)], new Set(), 2)).toBe(3)
  })

  it('skips read articles on the way forward', () => {
    expect(nextUnreadId([row(1), row(2, true), row(3, true), row(4)], new Set(), 1)).toBe(4)
  })

  it('skips saved articles — they have left the deck', () => {
    expect(nextUnreadId([row(1), row(2), row(3)], new Set([2]), 1)).toBe(3)
  })

  it('wraps to the top when the current article is last', () => {
    expect(nextUnreadId([row(1), row(2, true), row(3)], new Set(), 3)).toBe(1)
  })

  it('never returns the current article itself', () => {
    // Current is the only unread row (its isRead flip may not have landed yet).
    expect(nextUnreadId([row(1, true), row(2)], new Set(), 2)).toBeNull()
  })

  it('returns null when nothing unread and unsaved remains', () => {
    expect(nextUnreadId([row(1, true), row(2, true), row(3)], new Set([3]), 1)).toBeNull()
  })

  it('returns null when the current article is not in the list (no deck context)', () => {
    expect(nextUnreadId([row(1), row(2)], new Set(), 99)).toBeNull()
    expect(nextUnreadId([], new Set(), 1)).toBeNull()
  })
})

describe('prevUnreadId', () => {
  it('returns the unread article before the current one', () => {
    expect(prevUnreadId([row(1), row(2), row(3, true)], new Set(), 2)).toBe(1)
  })

  it('skips read articles on the way backward', () => {
    expect(prevUnreadId([row(1), row(2, true), row(3, true), row(4)], new Set(), 4)).toBe(1)
  })

  it('skips saved articles — they have left the deck', () => {
    expect(prevUnreadId([row(1), row(2), row(3)], new Set([2]), 3)).toBe(1)
  })

  it('wraps past the top when the current article is first', () => {
    expect(prevUnreadId([row(1), row(2, true), row(3)], new Set(), 1)).toBe(3)
  })

  it('never returns the current article itself', () => {
    expect(prevUnreadId([row(1, true), row(2)], new Set(), 2)).toBeNull()
  })

  it('returns null when nothing unread and unsaved remains', () => {
    expect(prevUnreadId([row(1, true), row(2, true), row(3)], new Set([3]), 1)).toBeNull()
  })

  it('returns null when the current article is not in the list (no deck context)', () => {
    expect(prevUnreadId([row(1), row(2)], new Set(), 99)).toBeNull()
    expect(prevUnreadId([], new Set(), 1)).toBeNull()
  })

  it('is nextUnreadId\'s inverse on an all-unread deck', () => {
    const deck = [row(1), row(2), row(3)]
    expect(prevUnreadId(deck, new Set(), nextUnreadId(deck, new Set(), 2)!)).toBe(2)
  })
})

describe('syncSlots', () => {
  it('keeps slot order and drops slots whose article left the pool', () => {
    expect(syncSlots([3, 1, 2], [1, 2])).toEqual([1, 2])
    expect(syncSlots([3, 1, 2], [1, 2, 3])).toEqual([3, 1, 2])
  })

  it('appends pool articles not yet slotted at the end — nothing shifts', () => {
    expect(syncSlots([2, 1], [1, 2, 4, 5])).toEqual([2, 1, 4, 5])
  })

  it('starts empty slots from pool order', () => {
    expect(syncSlots([], [1, 2, 3])).toEqual([1, 2, 3])
  })
})

describe('backfillSlot', () => {
  it('pulls the last slot into the vacated position — other slots keep their place', () => {
    expect(backfillSlot([1, 2, 3, 4], 2)).toEqual({ slots: [1, 4, 3], movedId: 4 })
    expect(backfillSlot([1, 2, 3, 4], 1)).toEqual({ slots: [4, 2, 3], movedId: 4 })
  })

  it('just shortens the list when the last slot itself is committed', () => {
    expect(backfillSlot([1, 2, 3], 3)).toEqual({ slots: [1, 2], movedId: null })
  })

  it('is a no-op for an id not in the slots', () => {
    expect(backfillSlot([1, 2], 9)).toEqual({ slots: [1, 2], movedId: null })
  })
})

describe('restoreSlot', () => {
  it('returns the undone card to its slot and the backfill to the end', () => {
    // backfillSlot([1,2,3,4], 2) → [1,4,3]; restoring 2 must give [1,2,3,4]
    expect(restoreSlot([1, 4, 3], 2, 1, 4)).toEqual([1, 2, 3, 4])
  })

  it('round-trips backfillSlot for every position', () => {
    const slots = [10, 20, 30, 40]
    for (const id of slots) {
      const i = slots.indexOf(id)
      const { slots: after, movedId } = backfillSlot(slots, id)
      expect(restoreSlot(after, id, i, movedId)).toEqual(slots)
    }
  })

  it('tolerates a backfill card that has itself been committed since', () => {
    // 4 backfilled slot 1, then 4 was committed too — only 2 comes back.
    expect(restoreSlot([1, 3], 2, 1, 4)).toEqual([1, 2, 3])
  })

  it('clamps an out-of-range index to the end', () => {
    expect(restoreSlot([1, 2], 9, 7, null)).toEqual([1, 2, 9])
  })
})
