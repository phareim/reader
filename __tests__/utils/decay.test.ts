import {
  DECAY,
  decayAge,
  hasFaded,
  halfLifeLabel,
  nextHalfLife,
  softCount,
} from '~/utils/decay'

const HOUR = 3_600_000
const NOW = Date.parse('2026-08-10T12:00:00Z')

describe('decayAge', () => {
  it('measures age in half-lives', () => {
    expect(decayAge(NOW - 72 * HOUR, 72, NOW)).toBeCloseTo(1)
    expect(decayAge(NOW - 36 * HOUR, 72, NOW)).toBeCloseTo(0.5)
    expect(decayAge(NOW - 24 * HOUR, 12, NOW)).toBeCloseTo(2)
  })

  it('equalizes across paces — the core Current insight', () => {
    // 18h-old news on an 18h half-life == 7d-old essay on a 7d half-life.
    const news = decayAge(NOW - 18 * HOUR, 18, NOW)
    const essay = decayAge(NOW - 7 * 24 * HOUR, 7 * 24, NOW)
    expect(news).toBeCloseTo(essay)
  })

  it('accepts ISO strings', () => {
    expect(decayAge('2026-08-07T12:00:00Z', 72, NOW)).toBeCloseTo(1)
  })

  it('falls back to the default half-life for null and 0', () => {
    const age = decayAge(NOW - DECAY.DEFAULT_HALF_LIFE_HOURS * HOUR, null, NOW)
    expect(age).toBeCloseTo(1)
    expect(decayAge(NOW - DECAY.DEFAULT_HALF_LIFE_HOURS * HOUR, 0, NOW)).toBeCloseTo(1)
  })

  it('treats a missing or unparseable date as age 0 (never fades)', () => {
    expect(decayAge(null, 72, NOW)).toBe(0)
    expect(decayAge(undefined, 72, NOW)).toBe(0)
    expect(decayAge('not a date', 72, NOW)).toBe(0)
  })

  it('gives future dates a negative age', () => {
    expect(decayAge(NOW + 12 * HOUR, 72, NOW)).toBeLessThan(0)
  })
})

describe('hasFaded', () => {
  it('fades at the horizon, not before', () => {
    const horizonHours = 72 * DECAY.FADE_HORIZON
    expect(hasFaded(NOW - (horizonHours - 1) * HOUR, 72, NOW)).toBe(false)
    expect(hasFaded(NOW - horizonHours * HOUR, 72, NOW)).toBe(true)
  })

  it('a fast feed fades in hours, a slow one holds for weeks', () => {
    const twoDaysAgo = NOW - 48 * HOUR
    expect(hasFaded(twoDaysAgo, 12, NOW)).toBe(true) // news pace: 36h horizon
    expect(hasFaded(twoDaysAgo, 720, NOW)).toBe(false) // 30d pace: 90d horizon
  })

  it('never fades undated articles', () => {
    expect(hasFaded(null, 12, NOW)).toBe(false)
  })

  it('the ∞ pace never fades, however old', () => {
    const twoYearsAgo = NOW - 2 * 365 * 24 * HOUR
    expect(hasFaded(twoYearsAgo, DECAY.FOREVER_HOURS, NOW)).toBe(false)
  })
})

describe('the ∞ pace and ordering', () => {
  it('orders ∞ articles by the default half-life — they drift down, not pin to top', () => {
    const aWeekAgo = NOW - 7 * 24 * HOUR
    expect(decayAge(aWeekAgo, DECAY.FOREVER_HOURS, NOW)).toBeCloseTo(
      decayAge(aWeekAgo, DECAY.DEFAULT_HALF_LIFE_HOURS, NOW)
    )
  })
})

describe('halfLifeLabel', () => {
  it('labels sub-day paces in hours and whole-day paces in days', () => {
    expect(halfLifeLabel(12)).toBe('12h')
    expect(halfLifeLabel(24)).toBe('1d')
    expect(halfLifeLabel(72)).toBe('3d')
    expect(halfLifeLabel(168)).toBe('7d')
    expect(halfLifeLabel(720)).toBe('30d')
  })

  it('shows the default pace for null/0', () => {
    expect(halfLifeLabel(null)).toBe('30d')
    expect(halfLifeLabel(0)).toBe('30d')
  })

  it('labels the ∞ pace', () => {
    expect(halfLifeLabel(DECAY.FOREVER_HOURS)).toBe('∞')
  })

  it('keeps non-whole-day values in hours', () => {
    expect(halfLifeLabel(100)).toBe('100h')
  })
})

describe('nextHalfLife', () => {
  it('cycles 12h → 1d → 3d → 7d → 30d → ∞ → 12h', () => {
    expect(nextHalfLife(12)).toBe(24)
    expect(nextHalfLife(24)).toBe(72)
    expect(nextHalfLife(72)).toBe(168)
    expect(nextHalfLife(168)).toBe(720)
    expect(nextHalfLife(720)).toBe(DECAY.FOREVER_HOURS)
    expect(nextHalfLife(DECAY.FOREVER_HOURS)).toBe(12)
  })

  it('starts a never-set feed from the default pace', () => {
    expect(nextHalfLife(null)).toBe(DECAY.FOREVER_HOURS) // default 30d → next stop
  })

  it('snaps an off-preset value to the cycle', () => {
    expect(nextHalfLife(100)).toBe(720) // 100 ≤ 168 → next after 168
    expect(nextHalfLife(9000)).toBe(DECAY.FOREVER_HOURS) // beyond every finite preset
  })
})

describe('softCount', () => {
  it('is precise up to the cap and soft past it', () => {
    expect(softCount(0)).toBe('0')
    expect(softCount(DECAY.COUNT_CAP)).toBe(String(DECAY.COUNT_CAP))
    expect(softCount(DECAY.COUNT_CAP + 1)).toBe(`${DECAY.COUNT_CAP}+`)
    expect(softCount(873)).toBe(`${DECAY.COUNT_CAP}+`)
  })
})
