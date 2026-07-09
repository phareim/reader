import { chunkTextForTts, TTS } from '../../utils/tts'

describe('chunkTextForTts', () => {
  it('returns no chunks for empty or whitespace-only input', () => {
    expect(chunkTextForTts('')).toEqual([])
    expect(chunkTextForTts('   \n\t  ')).toEqual([])
  })

  it('returns short text as a single chunk', () => {
    expect(chunkTextForTts('Hello world. This is fine.')).toEqual([
      'Hello world. This is fine.',
    ])
  })

  it('normalizes runs of whitespace and newlines', () => {
    expect(chunkTextForTts('One   two\n\nthree\tfour.')).toEqual(['One two three four.'])
  })

  it('splits on sentence boundaries without exceeding maxChars', () => {
    const chunks = chunkTextForTts('First sentence here. Second sentence here. Third one.', 25)
    expect(chunks).toEqual(['First sentence here.', 'Second sentence here.', 'Third one.'])
    for (const c of chunks) expect(c.length).toBeLessThanOrEqual(25)
  })

  it('packs multiple sentences into one chunk when they fit', () => {
    expect(chunkTextForTts('One. Two. Three.', 12)).toEqual(['One. Two.', 'Three.'])
  })

  it('honors ! ? and … terminators', () => {
    expect(chunkTextForTts('Really! Are you sure? Well…', 10)).toEqual([
      'Really!',
      'Are you',
      'sure?',
      'Well…',
    ])
  })

  it('hard-splits a single over-long sentence on word boundaries', () => {
    const chunks = chunkTextForTts('aaa bbb ccc ddd eee', 7)
    expect(chunks).toEqual(['aaa bbb', 'ccc ddd', 'eee'])
  })

  it('splits an unbreakable over-long word mid-word as a last resort', () => {
    const chunks = chunkTextForTts('x'.repeat(25), 10)
    expect(chunks).toEqual(['x'.repeat(10), 'x'.repeat(10), 'x'.repeat(5)])
  })

  it('loses no words across chunking', () => {
    const text = Array.from({ length: 120 }, (_, i) => `Sentence number ${i} ends here.`).join(' ')
    const chunks = chunkTextForTts(text, 200)
    expect(chunks.join(' ')).toEqual(text)
    for (const c of chunks) expect(c.length).toBeLessThanOrEqual(200)
  })

  it('uses the default budget under the server cap', () => {
    expect(TTS.MAX_CHUNK_CHARS).toBeLessThanOrEqual(3000)
    const text = 'A sensible sentence. '.repeat(400)
    for (const c of chunkTextForTts(text)) {
      expect(c.length).toBeLessThanOrEqual(TTS.MAX_CHUNK_CHARS)
    }
  })
})
