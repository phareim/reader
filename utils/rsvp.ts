/**
 * rsvp.ts — pure logic for Rapid Serial Visual Presentation reading.
 *
 * One word at a time, fixed in place, with the optimal-recognition-point
 * (ORP) letter pinned to a constant screen position so the eye never moves.
 * The overlay (`components/RsvpOverlay.vue`) owns the DOM and timers; this
 * module owns everything unit-testable: tokenizing, where the ORP falls,
 * and how long each word stays up.
 */

export const RSVP = {
  /** Words per minute. */
  WPM_DEFAULT: 300,
  WPM_MIN: 100,
  WPM_MAX: 800,
  WPM_STEP: 25,
  /** ←/→ jump size, in words. */
  SKIP_WORDS: 10,
  /** Extra dwell on the word a sentence ends with. */
  SENTENCE_PAUSE: 2.2,
  /** Extra dwell on a clause boundary (comma, dash, colon…). */
  CLAUSE_PAUSE: 1.5,
  /** Extra dwell on long words. */
  LONG_WORD_PAUSE: 1.3,
  LONG_WORD_CHARS: 9,
} as const

/** Plain text → the word stream. Whitespace-split, empties dropped. */
export function tokenizeWords(text: string | null | undefined): string[] {
  if (!text) return []
  return text.split(/\s+/).filter(Boolean)
}

/**
 * The optimal recognition point — the letter the eye should land on,
 * slightly left of center (the Spritz convention, keyed to word length).
 * Leading punctuation (quotes, parens) doesn't count toward the ORP; the
 * returned index is into the raw token.
 */
export function orpIndex(word: string): number {
  const lead = word.match(/^[^\p{L}\p{N}]+/u)?.[0].length ?? 0
  const core = word.slice(lead).replace(/[^\p{L}\p{N}]+$/u, '')
  if (!core.length) return Math.floor((word.length - 1) / 2)
  const n = core.length
  const orp = n === 1 ? 0 : n <= 5 ? 1 : n <= 9 ? 2 : n <= 13 ? 3 : 4
  return Math.min(lead + orp, word.length - 1)
}

/**
 * How long a word stays on screen. The base beat comes from the WPM; a word
 * that closes a sentence or clause dwells longer (that's where comprehension
 * happens), and long words get a little extra to be taken in whole.
 */
export function wordDelayMs(word: string, wpm: number): number {
  const base = 60000 / wpm
  let factor = 1
  if (/[.!?…]["'”’»)\]]*$/.test(word)) factor = RSVP.SENTENCE_PAUSE
  else if (/[,;:—–]["'”’»)\]]*$/.test(word)) factor = RSVP.CLAUSE_PAUSE
  if (word.length >= RSVP.LONG_WORD_CHARS) factor *= RSVP.LONG_WORD_PAUSE
  return Math.round(base * factor)
}
