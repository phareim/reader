import {
  resolveDirection,
  advance,
  undo,
  DECK,
  type DeckHistoryEntry,
} from '~/utils/deck'

describe('resolveDirection (velocity-aware)', () => {
  it('returns null for a tiny slow drag', () => {
    expect(resolveDirection(20, 5, 0, 0)).toBeNull()
  })

  it('commits on distance past the threshold', () => {
    expect(resolveDirection(DECK.DISTANCE_THRESHOLD + 1, 0, 0, 0)).toBe('right')
    expect(resolveDirection(-(DECK.DISTANCE_THRESHOLD + 1), 0, 0, 0)).toBe('left')
    expect(resolveDirection(0, -(DECK.DISTANCE_THRESHOLD + 1), 0, 0)).toBe('up')
    expect(resolveDirection(0, DECK.DISTANCE_THRESHOLD + 1, 0, 0)).toBe('down')
    expect(resolveDirection(DECK.DISTANCE_THRESHOLD, 0, 0, 0)).toBe('right')
  })

  it('commits on a fast flick below the distance threshold', () => {
    expect(resolveDirection(40, 0, DECK.VELOCITY_THRESHOLD + 1, 0)).toBe('right')
    expect(resolveDirection(-40, 0, -(DECK.VELOCITY_THRESHOLD + 1), 0)).toBe('left')
    expect(resolveDirection(0, -40, 0, -(DECK.VELOCITY_THRESHOLD + 1))).toBe('up')
    expect(resolveDirection(0, 40, 0, DECK.VELOCITY_THRESHOLD + 1)).toBe('down')
  })

  it('does NOT commit a flick whose velocity opposes the offset', () => {
    // dragged right but flicking back left toward origin
    expect(resolveDirection(60, 0, -(DECK.VELOCITY_THRESHOLD + 1), 0)).toBeNull()
    expect(resolveDirection(0, 60, 0, -(DECK.VELOCITY_THRESHOLD + 1))).toBeNull()
  })

  it('returns null when neither axis dominates', () => {
    const d = DECK.DISTANCE_THRESHOLD + 10
    expect(resolveDirection(d, d, 0, 0)).toBeNull()
  })

  it('picks the dominant axis', () => {
    const d = DECK.DISTANCE_THRESHOLD + 10
    expect(resolveDirection(d, d * 0.3, 0, 0)).toBe('right')
    expect(resolveDirection(d * 0.3, -d, 0, 0)).toBe('up')
  })
})

describe('advance', () => {
  const deck = ['a', 'b', 'c']

  it('removes the top card for save/read/elevate', () => {
    for (const action of ['left', 'right', 'up'] as const) {
      const { deck: next, entry } = advance(deck, action)
      expect(next).toEqual(['b', 'c'])
      expect(entry).toEqual({ id: 'a', action, prevIndex: 0 })
    }
  })

  it('rotates the top card to the back on skip (down)', () => {
    const { deck: next, entry } = advance(deck, 'down')
    expect(next).toEqual(['b', 'c', 'a'])
    expect(entry).toEqual({ id: 'a', action: 'down', prevIndex: 0 })
  })

  it('is a no-op on an empty deck', () => {
    const { deck: next, entry } = advance([], 'right')
    expect(next).toEqual([])
    expect(entry).toBeNull()
  })
})

describe('undo', () => {
  it('returns null with no history', () => {
    expect(undo(['a'], [])).toBeNull()
  })

  it('restores a removed card to the top and pops history', () => {
    const history: DeckHistoryEntry[] = [{ id: 'a', action: 'left', prevIndex: 0 }]
    const result = undo(['b', 'c'], history)!
    expect(result.deck).toEqual(['a', 'b', 'c'])
    expect(result.history).toEqual([])
    expect(result.entry.action).toBe('left')
  })

  it('moves a skipped card from the back to the top without duplicating', () => {
    const history: DeckHistoryEntry[] = [{ id: 'a', action: 'down', prevIndex: 0 }]
    const result = undo(['b', 'c', 'a'], history)!
    expect(result.deck).toEqual(['a', 'b', 'c'])
    expect(result.history).toEqual([])
    expect(result.entry.action).toBe('down')
  })
})
