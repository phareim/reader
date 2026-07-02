import {
  shouldRestorePosition,
  restoreScrollTop,
  progressWorthSaving
} from '~/utils/readingPosition'

describe('shouldRestorePosition', () => {
  it('restores a place mid-article', () => {
    expect(shouldRestorePosition(0.4)).toBe(true)
    expect(shouldRestorePosition(0.03)).toBe(true)
    expect(shouldRestorePosition(0.95)).toBe(true)
  })

  it('opens a barely-started article at the top', () => {
    expect(shouldRestorePosition(0)).toBe(false)
    expect(shouldRestorePosition(0.02)).toBe(false)
  })

  it('opens a finished article at the top, not the tail end', () => {
    expect(shouldRestorePosition(0.97)).toBe(false)
    expect(shouldRestorePosition(1)).toBe(false)
  })

  it('handles missing values', () => {
    expect(shouldRestorePosition(null)).toBe(false)
    expect(shouldRestorePosition(undefined)).toBe(false)
  })
})

describe('restoreScrollTop', () => {
  it('maps the fraction onto the scrollable range', () => {
    // 5000px page, 1000px viewport → 4000px scrollable
    expect(restoreScrollTop(0.5, 5000, 1000)).toBe(2000)
    expect(restoreScrollTop(0.25, 5000, 1000)).toBe(1000)
  })

  it('clamps to the scrollable range', () => {
    expect(restoreScrollTop(1.5, 5000, 1000)).toBe(4000)
    expect(restoreScrollTop(-0.5, 5000, 1000)).toBe(0)
  })

  it('returns 0 when the page does not scroll', () => {
    expect(restoreScrollTop(0.5, 800, 1000)).toBe(0)
    expect(restoreScrollTop(0.5, 1000, 1000)).toBe(0)
  })
})

describe('progressWorthSaving', () => {
  it('skips writes for sub-threshold movement', () => {
    expect(progressWorthSaving(0.405, 0.4)).toBe(false)
    expect(progressWorthSaving(0.4, 0.4)).toBe(false)
  })

  it('saves once the reader has actually moved', () => {
    expect(progressWorthSaving(0.42, 0.4)).toBe(true)
    expect(progressWorthSaving(0.35, 0.4)).toBe(true)
  })
})
