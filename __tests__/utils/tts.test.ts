import { chunkTextForTts, locateChunks, TTS } from '../../utils/tts'

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

describe('locateChunks', () => {
  it('maps a single chunk of already-clean text to its exact span', () => {
    const raw = 'Hello world. This is fine.'
    const chunks = chunkTextForTts(raw)
    const [span] = locateChunks(raw, chunks)
    expect(span).toEqual({ start: 0, end: raw.length })
  })

  it('maps chunks back through whitespace normalization', () => {
    const raw = '  First   sentence\n\nhere. Second\tsentence here. Third one.  '
    const chunks = chunkTextForTts(raw, 25)
    const spans = locateChunks(raw, chunks)
    expect(spans).toHaveLength(chunks.length)
    spans.forEach((span, i) => {
      expect(span).not.toBeNull()
      // The raw slice re-normalizes to exactly the chunk text.
      const slice = raw.slice(span!.start, span!.end)
      expect(slice.replace(/\s+/g, ' ').trim()).toBe(chunks[i])
      // Spans start and end on non-whitespace characters.
      expect(/\S/.test(raw[span!.start])).toBe(true)
      expect(/\S/.test(raw[span!.end - 1])).toBe(true)
    })
  })

  it('resolves repeated passages in order via the moving cursor', () => {
    const raw = 'Again and again. Again and again. Again and again.'
    const chunks = chunkTextForTts(raw, 20)
    expect(chunks).toEqual(['Again and again.', 'Again and again.', 'Again and again.'])
    const spans = locateChunks(raw, chunks)
    expect(spans.map((s) => s!.start)).toEqual([0, 17, 34])
  })

  it('covers the raw text contiguously (no gaps beyond whitespace)', () => {
    const raw = Array.from({ length: 40 }, (_, i) => `Sentence number ${i} ends  here.`).join('\n')
    const chunks = chunkTextForTts(raw, 120)
    const spans = locateChunks(raw, chunks)
    for (let i = 1; i < spans.length; i++) {
      const between = raw.slice(spans[i - 1]!.end, spans[i]!.start)
      expect(between.trim()).toBe('')
    }
    expect(spans[0]!.start).toBe(0)
    expect(spans[spans.length - 1]!.end).toBe(raw.length)
  })

  it('returns null for a chunk that does not occur in the text', () => {
    expect(locateChunks('Some text here.', ['not present'])).toEqual([null])
  })

  it('handles empty inputs', () => {
    expect(locateChunks('', [])).toEqual([])
    expect(locateChunks('text', [''])).toEqual([null])
  })
})
