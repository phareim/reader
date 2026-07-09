/**
 * Read-aloud (TTS) pure logic.
 *
 * The article body is spoken in chunks: the NVIDIA Magpie synthesis behind
 * `POST /api/tts` caps request length, and chunking gives fast time-to-first-
 * word (the first chunk plays while the rest synthesize). Chunks break on
 * sentence boundaries so the voice never stops mid-sentence.
 */

export const TTS = {
  /** Max characters per synthesis request (server caps at 3000). */
  MAX_CHUNK_CHARS: 1100,
} as const

/**
 * Split plain text into chunks of at most `maxChars`, breaking on sentence
 * boundaries. A single sentence longer than `maxChars` is hard-split on word
 * boundaries (and mid-word only as a last resort). Whitespace is normalized;
 * empty input yields no chunks.
 */
export function chunkTextForTts(text: string, maxChars: number = TTS.MAX_CHUNK_CHARS): string[] {
  const normalized = text.replace(/\s+/g, ' ').trim()
  if (!normalized) return []

  // Sentence-ish units: split after terminal punctuation followed by space.
  const sentences = normalized.split(/(?<=[.!?…])\s+/)

  const chunks: string[] = []
  let current = ''
  const push = () => {
    if (current) { chunks.push(current); current = '' }
  }

  for (const sentence of sentences) {
    for (const piece of splitLongSentence(sentence, maxChars)) {
      if (!current) current = piece
      else if (current.length + 1 + piece.length <= maxChars) current += ' ' + piece
      else { push(); current = piece }
    }
  }
  push()
  return chunks
}

export interface ChunkSpan {
  /** Inclusive character offset into the raw (un-normalized) source text. */
  start: number
  /** Exclusive character offset into the raw source text. */
  end: number
}

/**
 * Locate each chunk produced by `chunkTextForTts(raw)` back in the raw text,
 * as [start, end) character offsets. The chunker normalizes whitespace, so
 * this rebuilds the same normalization while keeping a map from every
 * normalized character to its raw index; each chunk is then a contiguous
 * substring of the normalized text, found with a moving cursor (so repeated
 * passages resolve in order). A chunk that can't be found maps to null.
 *
 * The reader uses the spans to build DOM Ranges over the article body — the
 * raw text is the article element's `textContent` — so the currently-spoken
 * passage can be shown and followed while the voice reads.
 */
export function locateChunks(raw: string, chunks: string[]): (ChunkSpan | null)[] {
  const map: number[] = []
  let normalized = ''
  let pendingWsIndex = -1
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i]
    if (/\s/.test(ch)) {
      if (normalized.length > 0 && pendingWsIndex < 0) pendingWsIndex = i
      continue
    }
    if (pendingWsIndex >= 0) {
      normalized += ' '
      map.push(pendingWsIndex)
      pendingWsIndex = -1
    }
    normalized += ch
    map.push(i)
  }

  let cursor = 0
  return chunks.map((chunk) => {
    if (!chunk) return null
    const idx = normalized.indexOf(chunk, cursor)
    if (idx < 0) return null
    cursor = idx + chunk.length
    return { start: map[idx], end: map[idx + chunk.length - 1] + 1 }
  })
}

/** Hard-split an over-long sentence on word boundaries, mid-word if a single
 *  "word" (a URL, say) exceeds the budget on its own. */
function splitLongSentence(sentence: string, maxChars: number): string[] {
  if (sentence.length <= maxChars) return [sentence]
  const pieces: string[] = []
  let current = ''
  for (const word of sentence.split(' ')) {
    if (word.length > maxChars) {
      if (current) { pieces.push(current); current = '' }
      for (let i = 0; i < word.length; i += maxChars) pieces.push(word.slice(i, i + maxChars))
      continue
    }
    if (!current) current = word
    else if (current.length + 1 + word.length <= maxChars) current += ' ' + word
    else { pieces.push(current); current = word }
  }
  if (current) pieces.push(current)
  return pieces
}
