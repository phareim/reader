import { tokenizeWords, orpIndex, wordDelayMs, RSVP } from '~/utils/rsvp'

describe('tokenizeWords', () => {
  it('splits on any whitespace and drops empties', () => {
    expect(tokenizeWords('  A calm\n\nreader\treads. ')).toEqual(['A', 'calm', 'reader', 'reads.'])
  })

  it('handles null/undefined/empty input', () => {
    expect(tokenizeWords(null)).toEqual([])
    expect(tokenizeWords(undefined)).toEqual([])
    expect(tokenizeWords('')).toEqual([])
    expect(tokenizeWords('   ')).toEqual([])
  })
})

describe('orpIndex', () => {
  it('follows the length-keyed convention', () => {
    expect(orpIndex('a')).toBe(0) // 1 letter → itself
    expect(orpIndex('to')).toBe(1) // 2–5 → second letter
    expect(orpIndex('paper')).toBe(1)
    expect(orpIndex('reader')).toBe(2) // 6–9 → third
    expect(orpIndex('hairlines')).toBe(2)
    expect(orpIndex('typographic')).toBe(3) // 10–13 → fourth
    expect(orpIndex('extraordinarily')).toBe(4) // 14+ → fifth
  })

  it('skips leading punctuation but indexes into the raw token', () => {
    expect(orpIndex('“paper')).toBe(2) // 1 quote + ORP 1 of "paper"
    expect(orpIndex('(reader)')).toBe(3) // 1 paren + ORP 2 of "reader"
  })

  it('ignores trailing punctuation when sizing the core', () => {
    expect(orpIndex('paper.')).toBe(1)
    expect(orpIndex('reader.”')).toBe(2)
  })

  it('centers on tokens with no letters at all', () => {
    expect(orpIndex('—')).toBe(0)
    expect(orpIndex('...')).toBe(1)
  })

  it('never exceeds the last index', () => {
    expect(orpIndex('“a')).toBe(1)
  })
})

describe('wordDelayMs', () => {
  const base = 60000 / 300

  it('gives a plain word the base beat', () => {
    expect(wordDelayMs('paper', 300)).toBe(Math.round(base))
  })

  it('scales with wpm', () => {
    expect(wordDelayMs('paper', 600)).toBe(Math.round(60000 / 600))
  })

  it('dwells on sentence ends, incl. closing quotes/parens', () => {
    expect(wordDelayMs('reads.', 300)).toBe(Math.round(base * RSVP.SENTENCE_PAUSE))
    expect(wordDelayMs('reads?”', 300)).toBe(Math.round(base * RSVP.SENTENCE_PAUSE))
    expect(wordDelayMs('reads…', 300)).toBe(Math.round(base * RSVP.SENTENCE_PAUSE))
  })

  it('dwells a little on clause boundaries', () => {
    expect(wordDelayMs('paper,', 300)).toBe(Math.round(base * RSVP.CLAUSE_PAUSE))
    expect(wordDelayMs('paper:', 300)).toBe(Math.round(base * RSVP.CLAUSE_PAUSE))
  })

  it('gives long words extra dwell, compounding with punctuation', () => {
    expect(wordDelayMs('typographic', 300)).toBe(Math.round(base * RSVP.LONG_WORD_PAUSE))
    expect(wordDelayMs('typographic.', 300)).toBe(
      Math.round(base * RSVP.SENTENCE_PAUSE * RSVP.LONG_WORD_PAUSE),
    )
  })
})
