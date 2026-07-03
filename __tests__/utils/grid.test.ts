import { GRID, resolveGridDirection, nextPageOffset, dedupeAppend } from '~/utils/grid'
import type { Article } from '~/types'

describe('resolveGridDirection', () => {
  it('commits on sufficient leftward distance', () => {
    expect(resolveGridDirection(-GRID.DISTANCE_THRESHOLD, 0)).toBe('left')
    expect(resolveGridDirection(-200, 0)).toBe('left')
  })

  it('commits on sufficient rightward distance', () => {
    expect(resolveGridDirection(GRID.DISTANCE_THRESHOLD, 0)).toBe('right')
  })

  it('returns null under the distance threshold with no flick', () => {
    expect(resolveGridDirection(-(GRID.DISTANCE_THRESHOLD - 1), 0)).toBeNull()
    expect(resolveGridDirection(30, 100)).toBeNull()
  })

  it('commits on a same-direction flick even under the distance threshold', () => {
    expect(resolveGridDirection(-20, -GRID.VELOCITY_THRESHOLD)).toBe('left')
    expect(resolveGridDirection(20, GRID.VELOCITY_THRESHOLD + 50)).toBe('right')
  })

  it('rejects a flick pointing back toward origin', () => {
    // Dragged right, flicked hard left — must not commit.
    expect(resolveGridDirection(40, -900)).toBeNull()
    expect(resolveGridDirection(-40, 900)).toBeNull()
  })

  it('zero movement resolves to null', () => {
    expect(resolveGridDirection(0, 0)).toBeNull()
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
