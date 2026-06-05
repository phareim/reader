import { describe, it, expect } from '@jest/globals'
import {
  resolveDirection,
  advance,
  undo,
  DECK_COMMIT_THRESHOLD,
  type DeckHistoryEntry,
} from '~/utils/deck'

describe('resolveDirection', () => {
  const T = 100 // threshold

  it('returns null for sub-threshold movement', () => {
    expect(resolveDirection(10, 0, T)).toBeNull()
    expect(resolveDirection(0, 10, T)).toBeNull()
    expect(resolveDirection(0, 0, T)).toBeNull()
  })

  it('resolves horizontal directions past threshold', () => {
    expect(resolveDirection(-150, 0, T)).toBe('left')
    expect(resolveDirection(150, 0, T)).toBe('right')
  })

  it('resolves vertical directions past threshold', () => {
    expect(resolveDirection(0, -150, T)).toBe('up')
    expect(resolveDirection(0, 150, T)).toBe('down')
  })

  it('returns null when neither axis dominates (diagonal)', () => {
    // equal magnitude → ambiguous
    expect(resolveDirection(150, 150, T)).toBeNull()
    expect(resolveDirection(-150, 140, T)).toBeNull()
  })

  it('respects horizontal dominance over a smaller vertical component', () => {
    // dx clearly dominates dy → horizontal
    expect(resolveDirection(150, 30, T)).toBe('right')
    expect(resolveDirection(-150, 30, T)).toBe('left')
  })

  it('respects vertical dominance over a smaller horizontal component', () => {
    expect(resolveDirection(30, 150, T)).toBe('down')
    expect(resolveDirection(30, -150, T)).toBe('up')
  })

  it('exposes a sane default commit threshold', () => {
    expect(DECK_COMMIT_THRESHOLD).toBeGreaterThan(0)
  })
})

describe('advance', () => {
  it('removes the top card on a left commit', () => {
    const { deck, entry } = advance(['a', 'b', 'c'], 'left')
    expect(deck).toEqual(['b', 'c'])
    expect(entry).toEqual({ id: 'a', action: 'left', prevIndex: 0 })
  })

  it('removes the top card on a right commit', () => {
    const { deck, entry } = advance(['a', 'b', 'c'], 'right')
    expect(deck).toEqual(['b', 'c'])
    expect(entry?.id).toBe('a')
  })

  it('removes the top card on a generic commit', () => {
    const { deck } = advance(['a', 'b', 'c'], 'commit')
    expect(deck).toEqual(['b', 'c'])
  })

  it('rotates the top card to the back on skip (down)', () => {
    const down = advance(['a', 'b', 'c'], 'down')
    expect(down.deck).toEqual(['b', 'c', 'a'])
    expect(down.entry?.action).toBe('down')

    const skip = advance(['a', 'b', 'c'], 'skip')
    expect(skip.deck).toEqual(['b', 'c', 'a'])
  })

  it('does not mutate the deck on up (open reader)', () => {
    const { deck, entry } = advance(['a', 'b', 'c'], 'up')
    expect(deck).toEqual(['a', 'b', 'c'])
    expect(entry).toBeNull()
  })

  it('is a no-op on an empty deck', () => {
    const { deck, entry } = advance([], 'left')
    expect(deck).toEqual([])
    expect(entry).toBeNull()
  })

  it('returns a new array (does not mutate input)', () => {
    const input = ['a', 'b']
    const { deck } = advance(input, 'left')
    expect(input).toEqual(['a', 'b'])
    expect(deck).not.toBe(input)
  })
})

describe('undo', () => {
  it('restores a removed card to the top and pops history', () => {
    const history: DeckHistoryEntry[] = [{ id: 'a', action: 'left', prevIndex: 0 }]
    const result = undo(['b', 'c'], history)
    expect(result).not.toBeNull()
    expect(result!.deck).toEqual(['a', 'b', 'c'])
    expect(result!.history).toEqual([])
    expect(result!.entry.id).toBe('a')
  })

  it('restores a skipped card to the top without duplicating it', () => {
    // 'a' was skipped to the back: deck is ['b','c','a']
    const history: DeckHistoryEntry[] = [{ id: 'a', action: 'down', prevIndex: 0 }]
    const result = undo(['b', 'c', 'a'], history)
    expect(result!.deck).toEqual(['a', 'b', 'c'])
  })

  it('returns null when there is nothing to undo', () => {
    expect(undo(['a', 'b'], [])).toBeNull()
  })

  it('unwinds multiple commits in LIFO order', () => {
    let deck = ['a', 'b', 'c']
    const history: DeckHistoryEntry[] = []

    let step = advance(deck, 'left') // remove a
    deck = step.deck
    if (step.entry) history.push(step.entry)

    step = advance(deck, 'right') // remove b
    deck = step.deck
    if (step.entry) history.push(step.entry)

    expect(deck).toEqual(['c'])

    const u1 = undo(deck, history)!
    expect(u1.deck).toEqual(['b', 'c'])
    expect(u1.entry.id).toBe('b')

    const u2 = undo(u1.deck, u1.history)!
    expect(u2.deck).toEqual(['a', 'b', 'c'])
    expect(u2.entry.id).toBe('a')
    expect(u2.history).toEqual([])
  })
})
