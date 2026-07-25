import type { Ref } from 'vue'
import { rangeForOffsets } from '~/utils/highlightDom'
import { chunkTextForTts, locateChunks, type ChunkSpan } from '~/utils/tts'

export type ReadAloudState = 'idle' | 'loading' | 'playing' | 'paused'

/**
 * The reading voice, for one article.
 *
 * The body is spoken in sentence-boundary chunks via `POST /api/tts` (NVIDIA
 * Magpie on Sleeper, OpenAI for Norwegian): chunk 0 plays as soon as it lands
 * while chunk 1 warms in the background. One reused `<audio>` element keeps
 * iOS's gesture unlock valid across chunk transitions. `ttsToken` invalidates
 * the whole in-flight session on stop/skip/unmount so a stale `onended` can't
 * restart playback.
 *
 * The text is taken from the live article element's `textContent` (not
 * `stripHtml`) so `locateChunks` can map every chunk back to exact character
 * offsets — the currently-spoken passage is painted with a crimson wash via the
 * CSS Custom Highlight API and gently kept in view. The Media Session API
 * mirrors the controls onto the lock screen / hardware keys (the iOS PWA case).
 *
 * Per-instance state, created and torn down with the reader page. **The caller
 * must call `stopReadAloud()` on unmount** — it revokes the object URL, drops
 * the audio source, and clears the media-session handlers.
 */
export function useReadAloud(opts: {
  /** The rendered article body — the source of both text and highlight ranges. */
  articleEl: Ref<HTMLElement | null>
  /** For the lock-screen metadata; reads `.title` / `.feedTitle`. */
  article: Ref<any>
}) {
  const { articleEl, article } = opts
  const { showError } = useToast()

  const readAloud = ref<ReadAloudState>('idle')
  const ttsIndex = ref(0)
  const ttsCount = ref(0)
  const ttsChunkFraction = ref(0) // 0..1 through the current chunk's audio

  let ttsAudio: HTMLAudioElement | null = null
  let ttsChunks: string[] = []
  let ttsSpans: (ChunkSpan | null)[] = []
  let ttsFetches: (Promise<Blob> | null)[] = []
  let ttsToken = 0
  let ttsUrl: string | null = null
  let ttsCharsBefore: number[] = []
  let ttsCharsTotal = 0

  const ttsProgress = computed(() => {
    if (!ttsCount.value || !ttsCharsTotal) return 0
    const len = ttsChunks[ttsIndex.value]?.length ?? 0
    const done = (ttsCharsBefore[ttsIndex.value] ?? 0) + ttsChunkFraction.value * len
    return Math.min(100, (done / ttsCharsTotal) * 100)
  })

  function ttsFetch(i: number): Promise<Blob> {
    if (!ttsFetches[i]) {
      ttsFetches[i] = $fetch<Blob>('/api/tts', {
        method: 'POST',
        body: { text: ttsChunks[i] },
        responseType: 'blob',
      })
    }
    return ttsFetches[i]!
  }

  function clearTtsHighlight() {
    ;(globalThis as any).CSS?.highlights?.delete('tts-reading')
  }

  /** Paint the passage the voice is speaking and gently keep it in view. */
  function followTtsChunk(i: number) {
    const root = articleEl.value
    const span = ttsSpans[i]
    if (!root || !span) { clearTtsHighlight(); return }
    const range = rangeForOffsets(root, span.start, span.end)
    if (!range) { clearTtsHighlight(); return }
    const cssAny = (globalThis as any).CSS
    const HighlightCtor = (globalThis as any).Highlight
    if (cssAny?.highlights && HighlightCtor) {
      cssAny.highlights.set('tts-reading', new HighlightCtor(range))
    }
    // Follow only when the passage's top has drifted out of the reading band —
    // bring it back to about a quarter down the viewport.
    const rect = range.getBoundingClientRect()
    if (rect.height && (rect.top < 72 || rect.top > window.innerHeight * 0.6)) {
      window.scrollTo({ top: window.scrollY + rect.top - window.innerHeight * 0.25, behavior: 'smooth' })
    }
  }

  async function playTtsChunk(i: number, token: number) {
    const blob = await ttsFetch(i)
    if (token !== ttsToken) return
    if (i + 1 < ttsChunks.length) ttsFetch(i + 1).catch(() => {})
    if (ttsUrl) URL.revokeObjectURL(ttsUrl)
    ttsUrl = URL.createObjectURL(blob)
    if (!ttsAudio) ttsAudio = new Audio()
    const audio = ttsAudio
    audio.src = ttsUrl
    audio.onended = () => {
      if (token !== ttsToken) return
      if (i + 1 < ttsChunks.length) {
        playTtsChunk(i + 1, token).catch(() => {
          if (token === ttsToken) { stopReadAloud(); showError('The reading voice dropped out') }
        })
      } else {
        stopReadAloud()
      }
    }
    audio.ontimeupdate = () => {
      if (token !== ttsToken) return
      const d = audio.duration
      ttsChunkFraction.value = Number.isFinite(d) && d > 0 ? audio.currentTime / d : 0
    }
    // The lock screen / hardware keys can pause the element directly — keep
    // the player state honest either way.
    audio.onpause = () => {
      if (token === ttsToken && readAloud.value === 'playing' && !audio.ended) readAloud.value = 'paused'
    }
    audio.onplay = () => {
      if (token === ttsToken && readAloud.value === 'paused') readAloud.value = 'playing'
    }
    ttsIndex.value = i
    ttsChunkFraction.value = 0
    followTtsChunk(i)
    await audio.play()
    if (token === ttsToken) readAloud.value = 'playing'
  }

  async function toggleReadAloud() {
    if (readAloud.value !== 'idle') { stopReadAloud(); return }
    const raw = articleEl.value?.textContent || ''
    const chunks = chunkTextForTts(raw)
    if (!chunks.length) return
    const token = ++ttsToken
    ttsChunks = chunks
    ttsSpans = locateChunks(raw, chunks)
    ttsFetches = chunks.map(() => null)
    ttsCharsBefore = []
    ttsCharsTotal = 0
    for (const c of chunks) { ttsCharsBefore.push(ttsCharsTotal); ttsCharsTotal += c.length }
    ttsCount.value = chunks.length
    ttsIndex.value = 0
    ttsChunkFraction.value = 0
    readAloud.value = 'loading'
    setupMediaSession()
    try {
      await playTtsChunk(0, token)
    } catch {
      if (token === ttsToken) { stopReadAloud(); showError('Could not reach the reading voice') }
    }
  }

  function pauseResumeReadAloud() {
    if (!ttsAudio) return
    if (readAloud.value === 'playing') { ttsAudio.pause(); readAloud.value = 'paused' }
    else if (readAloud.value === 'paused') { ttsAudio.play().catch(() => {}); readAloud.value = 'playing' }
  }

  function skipTtsChunk(delta: number) {
    if (readAloud.value !== 'playing' && readAloud.value !== 'paused') return
    const next = ttsIndex.value + delta
    if (next < 0 || next >= ttsChunks.length) return
    const token = ++ttsToken
    ttsAudio?.pause()
    readAloud.value = 'loading'
    playTtsChunk(next, token).catch(() => {
      if (token === ttsToken) { stopReadAloud(); showError('The reading voice dropped out') }
    })
  }

  function stopReadAloud() {
    ttsToken++
    if (ttsAudio) { ttsAudio.pause(); ttsAudio.removeAttribute('src') }
    if (ttsUrl) { URL.revokeObjectURL(ttsUrl); ttsUrl = null }
    clearTtsHighlight()
    teardownMediaSession()
    readAloud.value = 'idle'
    ttsChunkFraction.value = 0
  }

  // Lock-screen / hardware-key control (best-effort — not every browser ships
  // the Media Session API, and metadata assignment can throw on old WebKit).
  function setupMediaSession() {
    const ms = typeof navigator !== 'undefined' ? navigator.mediaSession : undefined
    if (!ms) return
    try {
      ms.metadata = new MediaMetadata({
        title: article.value?.title || 'Article',
        artist: article.value?.feedTitle || 'The Reader',
      })
      ms.setActionHandler('play', () => { if (readAloud.value === 'paused') pauseResumeReadAloud() })
      ms.setActionHandler('pause', () => { if (readAloud.value === 'playing') pauseResumeReadAloud() })
      ms.setActionHandler('stop', () => stopReadAloud())
      ms.setActionHandler('previoustrack', () => skipTtsChunk(-1))
      ms.setActionHandler('nexttrack', () => skipTtsChunk(1))
    } catch { /* best-effort */ }
  }

  function teardownMediaSession() {
    const ms = typeof navigator !== 'undefined' ? navigator.mediaSession : undefined
    if (!ms) return
    try {
      for (const a of ['play', 'pause', 'stop', 'previoustrack', 'nexttrack'] as const) {
        ms.setActionHandler(a, null)
      }
      ms.metadata = null
    } catch { /* best-effort */ }
  }

  return {
    readAloud,
    ttsIndex,
    ttsCount,
    ttsProgress,
    toggleReadAloud,
    pauseResumeReadAloud,
    skipTtsChunk,
    stopReadAloud,
  }
}
