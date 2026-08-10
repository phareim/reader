/**
 * decay.ts — half-life aging for the deck (the Current-inspired "velocity").
 *
 * Every feed has a half-life (hours); an article's decay age is its clock age
 * divided by that half-life. The deck orders by decay age — an 18-hour-old
 * item from a 18h-half-life news feed and a 7-day-old essay from a 7d-half-life
 * blog are equally "fresh" — and articles past FADE_HORIZON half-lives fade
 * out of decay-scoped unread queries entirely. Fading is a filter, not a verb:
 * nothing is marked read, and the article stays reachable via search.
 *
 * The SQL in `server/api/articles/index.get.ts` mirrors `decayAge`/`hasFaded`;
 * keep them in lockstep.
 */

export const DECAY = {
  /** Half-life applied when a feed has none set (NULL / 0), hours. */
  DEFAULT_HALF_LIFE_HOURS: 720,
  /**
   * Sentinel for the "∞" pace: articles from the feed never fade — they lie
   * in the deck until read. Ordering still uses the default half-life so an
   * evergreen card drifts down naturally instead of pinning to the top.
   */
  FOREVER_HOURS: -1,
  /** An article fades after this many half-lives. */
  FADE_HORIZON: 3,
  /** The deck header stops counting precisely past this ("40+"). */
  COUNT_CAP: 40,
  /**
   * The finite paces offered on Sources, in hours: 3d, 7d, 30d.
   * The cycle continues 30d → ∞ (FOREVER_HOURS) → 3d; see nextHalfLife.
   */
  PRESETS: [72, 168, 720],
} as const

/**
 * Age of an article measured in half-lives. `publishedAt` is an ISO string or
 * epoch ms; a missing/invalid date reads as age 0 (never fades — the SQL side
 * keeps NULL-dated rows for the same reason). Future dates give a negative age.
 * FOREVER_HOURS (and any non-positive half-life) falls back to the default —
 * the ∞ pace changes fading, not ordering.
 */
export function decayAge(
  publishedAt: string | number | null | undefined,
  halfLifeHours: number | null | undefined,
  now: number = Date.now(),
): number {
  if (publishedAt == null) return 0
  const t = typeof publishedAt === 'number' ? publishedAt : Date.parse(publishedAt)
  if (Number.isNaN(t)) return 0
  const halfLife = halfLifeHours && halfLifeHours > 0 ? halfLifeHours : DECAY.DEFAULT_HALF_LIFE_HOURS
  return (now - t) / (halfLife * 3_600_000)
}

/** True once an article is past the fade horizon. The ∞ pace never fades. */
export function hasFaded(
  publishedAt: string | number | null | undefined,
  halfLifeHours: number | null | undefined,
  now: number = Date.now(),
): boolean {
  if (halfLifeHours === DECAY.FOREVER_HOURS) return false
  return decayAge(publishedAt, halfLifeHours, now) >= DECAY.FADE_HORIZON
}

/** Short label for a half-life value: 12 → "12h", 72 → "3d", ∞ pace → "∞", null → "30d" (default). */
export function halfLifeLabel(hours: number | null | undefined): string {
  if (hours === DECAY.FOREVER_HOURS) return '∞'
  const h = hours && hours > 0 ? hours : DECAY.DEFAULT_HALF_LIFE_HOURS
  if (h < 24) return `${h}h`
  const days = h / 24
  return Number.isInteger(days) ? `${days}d` : `${h}h`
}

/**
 * The next stop in the Sources pace cycle (3d → 7d → 30d → ∞ → 3d):
 * the first preset strictly above the current pace, ∞ past the last, and
 * around again. Off-preset values (a removed preset, a hand-set number)
 * snap to the next stop up.
 */
export function nextHalfLife(current: number | null | undefined): number {
  if (current === DECAY.FOREVER_HOURS) return DECAY.PRESETS[0]
  const presets: readonly number[] = DECAY.PRESETS
  const effective = current && current > 0 ? current : DECAY.DEFAULT_HALF_LIFE_HOURS
  return presets.find((p) => p > effective) ?? DECAY.FOREVER_HOURS
}

/**
 * The flexible unread count: precise while the number is small enough to be
 * a plan, capped once it would only be a debt ("40+"). Counting was the
 * problem — this keeps the number useful without letting it loom.
 */
export function softCount(n: number, cap: number = DECAY.COUNT_CAP): string {
  return n > cap ? `${cap}+` : String(n)
}
