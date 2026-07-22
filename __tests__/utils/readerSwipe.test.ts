import { READER_SWIPE, resolveReaderSwipe, readerSwipeProgress } from '~/utils/readerSwipe'

// A comfortable mid-screen start on a phone-sized viewport.
const START = 200
const WIDTH = 400

describe('resolveReaderSwipe', () => {
  it('commits on a long, decisively horizontal leftward drag', () => {
    expect(resolveReaderSwipe(-160, 10, 0, START, WIDTH)).toBe(true)
  })

  it('commits on a fast leftward flick short of the distance threshold', () => {
    expect(resolveReaderSwipe(-60, 0, -900, START, WIDTH)).toBe(true)
  })

  it('never commits rightward — there is no right verb in the reader', () => {
    expect(resolveReaderSwipe(200, 0, 900, START, WIDTH)).toBe(false)
  })

  it('rejects a diagonal drag (scroll wins under the 3:1 dominance gate)', () => {
    // 160px left but 80px vertical: 160 < 80 * 3 — a scroll, not a swipe.
    expect(resolveReaderSwipe(-160, -80, 0, START, WIDTH)).toBe(false)
  })

  it('accepts the deck-loose diagonal only when truly flat', () => {
    // Same dx with dy right at the dominance boundary commits…
    expect(resolveReaderSwipe(-160, -50, 0, START, WIDTH)).toBe(true)
    // …one pixel more vertical and it does not.
    expect(resolveReaderSwipe(-160, -54, 0, START, WIDTH)).toBe(false)
  })

  it('rejects a slow drag short of the distance threshold', () => {
    expect(resolveReaderSwipe(-120, 0, -300, START, WIDTH)).toBe(false)
  })

  it('rejects a flick whose velocity points back toward origin', () => {
    // Dragged left, released while moving right — a recoil, not a commit.
    expect(resolveReaderSwipe(-60, 0, 900, START, WIDTH)).toBe(false)
  })

  it('rejects gestures starting in the left edge-navigation zone', () => {
    expect(resolveReaderSwipe(-200, 0, -900, READER_SWIPE.EDGE_GUARD - 1, WIDTH)).toBe(false)
    expect(resolveReaderSwipe(-200, 0, -900, READER_SWIPE.EDGE_GUARD, WIDTH)).toBe(true)
  })

  it('rejects gestures starting in the right edge-navigation zone', () => {
    expect(resolveReaderSwipe(-200, 0, -900, WIDTH - READER_SWIPE.EDGE_GUARD + 1, WIDTH)).toBe(false)
    expect(resolveReaderSwipe(-200, 0, -900, WIDTH - READER_SWIPE.EDGE_GUARD, WIDTH)).toBe(true)
  })
})

describe('readerSwipeProgress', () => {
  it('is zero at rest and for rightward drags', () => {
    expect(readerSwipeProgress(0, 0)).toBe(0)
    expect(readerSwipeProgress(80, 0)).toBe(0)
  })

  it('is zero for drags the dominance gate would reject', () => {
    expect(readerSwipeProgress(-100, -50)).toBe(0)
  })

  it('ramps toward 1 at the distance threshold and caps there', () => {
    expect(readerSwipeProgress(-READER_SWIPE.DISTANCE_THRESHOLD / 2, 0)).toBeCloseTo(0.5)
    expect(readerSwipeProgress(-READER_SWIPE.DISTANCE_THRESHOLD, 0)).toBe(1)
    expect(readerSwipeProgress(-READER_SWIPE.DISTANCE_THRESHOLD * 2, 0)).toBe(1)
  })
})
