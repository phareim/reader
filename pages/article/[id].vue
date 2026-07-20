<template>
  <!-- Reading progress: a hairline-thin rail on the right edge that fills
       downward as the reader scrolls through the article. -->
  <div class="fixed right-0 top-0 z-40 h-screen w-[2px] bg-rule" aria-hidden="true">
    <div class="w-full bg-mute" :style="{ height: scrollPercent + '%' }" />
  </div>

  <main class="mx-auto max-w-measure px-5 py-6">
    <!-- Action row. On phones the buttons collapse to icons (see ActionLabel)
         so the four of them stay within the hairline rule's width; from sm: up
         they spell out their labels. -->
    <div class="flex items-center justify-between">
      <ActionLabel aria-label="Back" @click="goBack">
        <template #icon>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5" /><path d="M12 5l-7 7 7 7" /></svg>
        </template>
        Back
      </ActionLabel>
      <div class="flex gap-1.5 sm:gap-2">
        <ActionLabel
          :aria-label="readAloud === 'idle' ? 'Read aloud' : 'Stop reading aloud'"
          @click="toggleReadAloud"
        >
          <template #icon>
            <svg v-if="readAloud === 'playing' || readAloud === 'paused'" width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="7" y="7" width="10" height="10" /></svg>
            <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5L6 9H2v6h4l5 4z" /><path d="M15.5 8.5a5 5 0 0 1 0 7" /><path d="M18.5 5.5a9 9 0 0 1 0 13" /></svg>
          </template>
          {{ readAloud === 'idle' ? 'Listen' : readAloud === 'loading' ? 'Voice…' : 'Stop' }}
        </ActionLabel>
        <ActionLabel aria-label="Speed read" @click="openRsvp">
          <template #icon>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h9" /><path d="M3 12h6" /><path d="M3 18h9" /><path d="M15 8.5l6 3.5-6 3.5z" /></svg>
          </template>
          RSVP
        </ActionLabel>
        <ActionLabel :accent="saved" :aria-label="saved ? 'Saved' : 'Save'" @click="toggleSaveAction">
          <template #icon>
            <svg width="14" height="14" viewBox="0 0 24 24" :fill="saved ? 'currentColor' : 'none'" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M6 4h12v16l-6-4-6 4z" /></svg>
          </template>
          {{ saved ? 'Saved' : 'Save' }}
        </ActionLabel>
        <ActionLabel v-if="personal" aria-label="Elevate" :disabled="elevating" @click="elevateAction">
          <template #icon>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5" /><path d="M6 11l6-6 6 6" /></svg>
          </template>
          {{ elevating ? 'Elevating…' : 'Elevate' }}
        </ActionLabel>
        <ActionLabel aria-label="Open original" @click="openOriginal">
          <template #icon>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17L17 7" /><path d="M9 7h8v8" /></svg>
          </template>
          Original
        </ActionLabel>
      </div>
    </div>
    <HairlineRule class="mt-4" />

    <template v-if="article">
      <header class="mt-8">
        <div class="flex items-baseline justify-between">
          <MonoLabel dash>{{ article.feedTitle }}</MonoLabel>
          <MonoLabel>{{ relativeDate }}</MonoLabel>
        </div>
        <h1 class="mt-3 text-3xl leading-tight text-ink">{{ article.title }}</h1>
        <p v-if="article.author" class="mt-2 italic text-mute">{{ article.author }}</p>
      </header>

      <HairlineRule class="my-6" />

      <p v-if="fetchingFullText" class="italic text-mute">Fetching the full article…</p>
      <article ref="articleEl" class="prose" v-html="sanitizedContent" @click="onArticleClick" />

      <HairlineRule class="my-6" />
      <!-- Mark-as-read sits inline with the good-read star and the two share
           buttons. The share buttons (public web-intent compose URLs) stay
           non-accent so the single crimson stays on "Mark as read"; the star
           takes the accent only once marked (same precedent as the Save
           bookmark); brand glyphs render on every width. -->
      <div class="flex items-center justify-center gap-3 pb-24">
        <ActionLabel accent :disabled="markingRead" aria-label="Mark as read" @click="markReadAndReturn">
          <template #icon>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12.5l5 5L20 6.5" /></svg>
          </template>
          <template #compact>{{ markingRead ? 'Marking…' : 'Read' }}</template>
          {{ markingRead ? 'Marking…' : 'Mark as read' }}
        </ActionLabel>

        <ActionLabel
          :accent="goodRead"
          :aria-label="goodRead ? 'Unmark good read' : 'Mark as a good read'"
          @click="toggleGoodReadAction"
        >
          <template #icon>
            <svg width="13" height="13" viewBox="0 0 24 24" :fill="goodRead ? 'currentColor' : 'none'" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l2.9 5.9 6.5.9-4.7 4.6 1.1 6.4L12 17.8l-5.8 3 1.1-6.4L2.6 9.8l6.5-.9z" /></svg>
          </template>
          Good read
        </ActionLabel>

        <template v-if="article.url">
          <ActionLabel aria-label="Share on X" @click="shareTo('x')">
            <template #icon>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>
            </template>
            X
          </ActionLabel>
          <ActionLabel aria-label="Share on Threads" @click="shareTo('threads')">
            <template #icon>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M12.186 24h-.007c-3.581-.024-6.334-1.205-8.184-3.509C2.35 18.44 1.5 15.586 1.472 12.01v-.017c.03-3.579.879-6.43 2.525-8.482C5.845 1.205 8.6.024 12.18 0h.014c2.746.02 5.043.725 6.826 2.098 1.677 1.29 2.858 3.13 3.509 5.467l-2.04.569c-1.104-3.96-3.898-5.984-8.304-6.015-2.91.022-5.11.936-6.54 2.717C4.307 6.504 3.616 8.914 3.59 12c.026 3.086.717 5.496 2.057 7.164 1.43 1.783 3.631 2.698 6.54 2.717 2.623-.02 4.358-.631 5.8-2.045 1.647-1.613 1.618-3.593 1.09-4.798-.31-.71-.873-1.3-1.634-1.75-.192 1.352-.622 2.446-1.284 3.272-.886 1.102-2.14 1.704-3.73 1.79-1.202.065-2.361-.218-3.259-.801-1.063-.689-1.685-1.74-1.752-2.964-.065-1.19.408-2.285 1.331-3.082.88-.76 2.119-1.207 3.583-1.291a13.853 13.853 0 0 1 3.02.142c-.126-.742-.375-1.332-.75-1.757-.513-.586-1.308-.883-2.359-.89h-.029c-.844 0-1.992.232-2.721 1.32L7.734 7.847c.98-1.454 2.568-2.256 4.478-2.256h.044c3.194.02 5.097 1.975 5.287 5.388.108.046.216.094.32.142 1.49.7 2.58 1.761 3.154 3.07.797 1.82.871 4.79-1.548 7.158-1.85 1.81-4.094 2.628-7.277 2.65Zm1.003-11.69c-.242 0-.487.007-.739.021-1.836.103-2.98.946-2.916 2.143.067 1.256 1.452 1.839 2.784 1.767 1.224-.065 2.818-.543 3.086-3.71a10.5 10.5 0 0 0-2.215-.221z" /></svg>
            </template>
            Threads
          </ActionLabel>
        </template>
      </div>
    </template>

    <p v-else-if="error" class="mt-10 italic text-mute">{{ error }}</p>
    <p v-else class="mt-10 italic text-mute">Loading…</p>

    <!-- Floating affordance shown while a passage is selected. On touch it
         is a fixed pill low on the screen, deliberately NOT tracking the
         selection: on a phone the text column is nearly full-width, and iOS
         routes touches on selected text to the system selection UI (handles
         + callout) before web content sees them — an overlapping button is
         unpressable no matter its z-index. With a mouse it sits below the
         selection center. mousedown.prevent keeps the native selection from
         collapsing before the click lands. -->
    <div
      v-if="pill"
      class="fixed z-40 -translate-x-1/2"
      :class="pill.side === 'below' ? 'pt-2' : undefined"
      :style="pill.side === 'bottom'
        ? { left: '50%', bottom: `calc(env(safe-area-inset-bottom) + ${readAloud === 'idle' ? '1.5rem' : '5.5rem'})` }
        : { left: pill.x + 'px', top: pill.y + 'px' }"
      @mousedown.prevent
    >
      <ActionLabel accent class="bg-paper" @click="startHighlight">Highlight</ActionLabel>
    </div>

    <HighlightNoteOverlay
      v-if="noteOverlay"
      :quote="noteOverlay.quote"
      :saving="savingNote"
      @save="saveHighlight"
      @close="noteOverlay = null"
    />

    <RsvpOverlay v-if="rsvpOpen" :words="rsvpWords" @close="rsvpOpen = false" />

    <HighlightPopover
      v-if="popover"
      :highlight="popover.highlight"
      :x="popover.x"
      :y="popover.y"
      :source-url="article?.url"
      @remove="removeHighlight"
      @close="popover = null"
    />

    <!-- Read-aloud player: a fixed bottom bar while the voice speaks. The
         hairline rail fills with overall progress (char-weighted across
         chunks); the crimson wash in the body marks the spoken passage
         itself. Pause/Resume carries the accent — it is the moment of
         attention while listening. -->
    <div v-if="readAloud !== 'idle'" class="fixed inset-x-0 bottom-0 z-40 border-t border-rule bg-paper">
      <div class="h-[2px] w-full" aria-hidden="true">
        <div class="h-full bg-accent-ink" :style="{ width: ttsProgress + '%' }" />
      </div>
      <div class="mx-auto flex max-w-measure items-center justify-between gap-2 px-5 py-2.5">
        <MonoLabel dash class="whitespace-nowrap">{{ readAloud === 'loading' ? 'Voice…' : `Reading ${ttsIndex + 1}/${ttsCount}` }}</MonoLabel>
        <div class="flex items-center gap-1.5 sm:gap-2">
          <ActionLabel aria-label="Previous passage" :disabled="ttsIndex === 0" @click="skipTtsChunk(-1)">
            <template #icon>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M19 20L9 12l10-8z" /><path d="M5 19V5" /></svg>
            </template>
            Back
          </ActionLabel>
          <ActionLabel
            accent
            :aria-label="readAloud === 'playing' ? 'Pause' : 'Resume'"
            :disabled="readAloud === 'loading'"
            @click="pauseResumeReadAloud"
          >
            <template #icon>
              <svg v-if="readAloud === 'playing'" width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" /><rect x="14" y="5" width="4" height="14" /></svg>
              <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5l11 7-11 7z" /></svg>
            </template>
            {{ readAloud === 'playing' ? 'Pause' : 'Resume' }}
          </ActionLabel>
          <ActionLabel aria-label="Next passage" :disabled="ttsIndex >= ttsCount - 1" @click="skipTtsChunk(1)">
            <template #icon>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M5 4l10 8-10 8z" /><path d="M19 5v14" /></svg>
            </template>
            Next
          </ActionLabel>
          <ActionLabel aria-label="Stop reading aloud" @click="stopReadAloud">
            <template #icon>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="7" y="7" width="10" height="10" /></svg>
            </template>
            Stop
          </ActionLabel>
        </div>
      </div>
    </div>
  </main>
</template>

<script setup lang="ts">
import { formatRelativeDate } from '~/utils/formatDate'
import { stripHtml } from '~/utils/cardData'
import { processArticleContent } from '~/utils/processArticleContent'
import { looksLikePlainText } from '~/utils/paragraphize'
import { looksTruncated } from '~/utils/truncation'
import { getSelectionOffsets, paintHighlight, unpaint, clearHighlights, rangeForOffsets } from '~/utils/highlightDom'
import { shouldRestorePosition, restoreScrollTop, progressWorthSaving } from '~/utils/readingPosition'
import { xShareUrl, threadsShareUrl } from '~/utils/share'
import { tokenizeWords } from '~/utils/rsvp'
import { chunkTextForTts, locateChunks, type ChunkSpan } from '~/utils/tts'
import type { Highlight } from '~/composables/useHighlights'

const route = useRoute()
const router = useRouter()
const id = Number(route.params.id)

const { isSaved, saveArticle, unsaveArticle, fetchSavedArticleIds } = useSavedArticles()
const { isGoodRead, seedGoodRead, toggleGoodRead } = useGoodReads()
const { elevate } = useElevate()
const { personal } = useAuth()
const { markAsRead } = useArticles()
const { fetchHighlights, createHighlight, deleteHighlight } = useHighlights()
const { showSuccess, showError } = useToast()

const article = ref<any>(null)
const error = ref<string | null>(null)
const fetchingFullText = ref(false)
const elevating = ref(false)
const markingRead = ref(false)

// ── Highlights ──────────────────────────────────────────────────────────────
const articleEl = ref<HTMLElement | null>(null)
const highlights = ref<Highlight[]>([])
const pendingSel = ref<{ startOffset: number; endOffset: number; quote: string } | null>(null)
const pill = ref<{ side: 'bottom' | 'below'; x: number; y: number } | null>(null)
const noteOverlay = ref<{ quote: string } | null>(null)
const savingNote = ref(false)
const popover = ref<{ highlight: Highlight; x: number; y: number } | null>(null)

/** Re-paint every stored highlight onto the (re-rendered) article body. */
function repaintHighlights() {
  const el = articleEl.value
  if (!el) return
  clearHighlights(el)
  for (const h of highlights.value) {
    paintHighlight(el, { id: h.id, startOffset: h.startOffset, endOffset: h.endOffset, quote: h.quote })
  }
}

async function loadHighlights() {
  highlights.value = await fetchHighlights(id).catch(() => [])
  await nextTick()
  repaintHighlights()
}

function onSelect() {
  const el = articleEl.value
  if (!el || noteOverlay.value || popover.value) return
  const offsets = getSelectionOffsets(el)
  if (!offsets) { pill.value = null; pendingSel.value = null; return }
  pendingSel.value = offsets
  const rect = window.getSelection()?.getRangeAt(0).getBoundingClientRect()
  if (rect && rect.width) {
    if (window.matchMedia('(pointer: coarse)').matches) {
      // Touch: a fixed pill low on the screen — never positioned relative to
      // the selection, because touches on selected text belong to the OS
      // (selection handles + callout sit above all web content).
      pill.value = { side: 'bottom', x: 0, y: 0 }
    } else {
      // Mouse: below the selection center. Clamp so a selection ending at
      // the bottom of the viewport keeps the pill on-screen.
      pill.value = {
        side: 'below',
        x: rect.left + rect.width / 2,
        y: Math.min(rect.bottom, window.innerHeight - 64),
      }
    }
  }
}

function startHighlight() {
  if (!pendingSel.value) return
  noteOverlay.value = { quote: pendingSel.value.quote }
  pill.value = null
}

async function saveHighlight(note: string) {
  const sel = pendingSel.value
  if (!sel || savingNote.value) return
  savingNote.value = true
  try {
    const h = await createHighlight(id, {
      quote: sel.quote, note, startOffset: sel.startOffset, endOffset: sel.endOffset,
    })
    highlights.value = [...highlights.value, h]
    await nextTick()
    if (articleEl.value) {
      paintHighlight(articleEl.value, {
        id: h.id, startOffset: h.startOffset, endOffset: h.endOffset, quote: h.quote,
      })
    }
    showSuccess('Highlighted')
    noteOverlay.value = null
    pendingSel.value = null
    window.getSelection()?.removeAllRanges()
  } catch {
    showError('Could not save the highlight')
  } finally {
    savingNote.value = false
  }
}

function onArticleClick(e: MouseEvent) {
  const mark = (e.target as HTMLElement)?.closest?.('[data-hl-id]')
  if (!mark) return
  const hid = Number(mark.getAttribute('data-hl-id'))
  const h = highlights.value.find((x) => x.id === hid)
  if (!h) return
  e.preventDefault()
  const rect = mark.getBoundingClientRect()
  popover.value = { highlight: h, x: rect.left, y: rect.bottom }
}

async function removeHighlight() {
  const h = popover.value?.highlight
  if (!h) return
  try {
    await deleteHighlight(h.id)
    highlights.value = highlights.value.filter((x) => x.id !== h.id)
    if (articleEl.value) unpaint(articleEl.value, h.id)
    showSuccess('Removed')
  } catch {
    showError('Could not remove the highlight')
  } finally {
    popover.value = null
  }
}

const saved = computed(() => isSaved(id))
const goodRead = computed(() => isGoodRead(id))
const relativeDate = computed(() =>
  article.value?.publishedAt ? formatRelativeDate(article.value.publishedAt) : ''
)
const sanitizedContent = computed(() =>
  processArticleContent(article.value?.content, { title: article.value?.title }) ?? ''
)

// ── RSVP (speed read) ───────────────────────────────────────────────────────
const rsvpOpen = ref(false)
const rsvpWords = computed(() => tokenizeWords(stripHtml(sanitizedContent.value)))

function openRsvp() {
  if (!rsvpWords.value.length) return
  rsvpOpen.value = true
}

// ── Read aloud ──────────────────────────────────────────────────────────────
// The body is spoken in sentence-boundary chunks via `POST /api/tts` (NVIDIA
// Magpie on Sleeper): chunk 0 plays as soon as it lands while chunk 1 warms
// in the background. One reused <audio> element keeps iOS's gesture unlock
// valid across chunk transitions. `ttsToken` invalidates the whole in-flight
// session on stop/skip/unmount so a stale onended can't restart playback.
//
// The text is taken from the live article element's textContent (not
// stripHtml) so `locateChunks` can map every chunk back to exact character
// offsets — the currently-spoken passage is painted with a crimson wash via
// the CSS Custom Highlight API and gently kept in view. A fixed bottom bar
// carries the controls: pause/resume, skip a passage back/forward, stop, and
// a char-weighted progress rail. The Media Session API mirrors the controls
// onto the lock screen / hardware keys (the iOS PWA case).
const readAloud = ref<'idle' | 'loading' | 'playing' | 'paused'>('idle')
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

// The body can re-render once (thin-RSS full-text upgrade); re-anchor after.
watch(sanitizedContent, () => nextTick().then(repaintHighlights))

/**
 * RSS bodies under ~1200 visible chars are treated as excerpts → fetch full
 * text. Some feeds (Ars Technica, FeedBurner) ship longer excerpts that still
 * end in a "Read full article" footer — `looksTruncated` catches those too.
 */
const THIN_CHARS = 1200

onMounted(async () => {
  fetchSavedArticleIds().catch(() => {})
  try {
    article.value = await $fetch(`/api/articles/${id}`)
  } catch (err: any) {
    error.value = err.statusMessage || 'Could not load the article'
    return
  }
  seedGoodRead(id, !!article.value?.isGoodRead)

  const content = article.value?.content || ''
  const visible = stripHtml(content)
  const status = article.value?.fullTextStatus
  // Never auto-fetch for Found items (a collector already pushed the full
  // body — the source URL is a JS shell), nor retry a page we already failed
  // or declined to extract (avoids re-fetching on every open).
  const upgradable =
    article.value?.feedKind !== 'found' && status !== 'failed' && status !== 'skipped'
  // Thin bodies are excerpts — but a body we already full-text-fetched won't
  // get any fuller by fetching again.
  const thin = visible.length < THIN_CHARS && status !== 'fetched'
  // A truncated excerpt that cleared THIN_CHARS.
  const truncated = looksTruncated(content, article.value?.url) && status !== 'fetched'
  if (upgradable && (thin || truncated)) {
    fetchingFullText.value = true
    try {
      await $fetch(`/api/articles/${id}/fetch-fulltext`, { method: 'POST' })
      article.value = await $fetch(`/api/articles/${id}`)
    } catch {
      // Keep the excerpt — "Original" is one tap away.
    } finally {
      fetchingFullText.value = false
    }
  } else if (upgradable && looksLikePlainText(content)) {
    // Legacy tag-less full text: silently upgrade the stored copy to rich
    // HTML. The paragraphized version already renders fine meanwhile, and
    // the new pipeline always stores tagged HTML, so this fires once.
    try {
      await $fetch(`/api/articles/${id}/fetch-fulltext`, { method: 'POST' })
      article.value = await $fetch(`/api/articles/${id}`)
    } catch {
      // Keep the paragraphized plain text.
    }
  }

  await loadHighlights()
  await restoreReadingPosition()
})

// ── Reading position ────────────────────────────────────────────────────────
// The place in the article survives leaving it: saved server-side (debounced)
// as a fraction of the scrollable height, restored when the article reopens.
let lastSavedProgress = 0
let progressSaveTimer: ReturnType<typeof setTimeout> | null = null

function persistProgress() {
  if (progressSaveTimer) { clearTimeout(progressSaveTimer); progressSaveTimer = null }
  if (!article.value) return
  const p = Math.min(1, Math.max(0, scrollPercent.value / 100))
  if (!progressWorthSaving(p, lastSavedProgress)) return
  lastSavedProgress = p
  $fetch(`/api/articles/${id}/progress`, { method: 'PATCH', body: { progress: p } }).catch(() => {})
}

function scheduleProgressSave() {
  if (progressSaveTimer) clearTimeout(progressSaveTimer)
  progressSaveTimer = setTimeout(persistProgress, 1500)
}

async function restoreReadingPosition() {
  const stored = Number(article.value?.readProgress) || 0
  lastSavedProgress = stored
  if (!shouldRestorePosition(stored)) return
  await nextTick()
  const doc = document.documentElement
  const scrollHeight = Math.max(doc.scrollHeight, document.body.scrollHeight)
  window.scrollTo({ top: restoreScrollTop(stored, scrollHeight, window.innerHeight) })
}

// Backgrounding the (PWA) app may be the last signal we get — flush then.
function onVisibilityChange() {
  if (document.visibilityState === 'hidden') persistProgress()
}

function goBack() {
  if (window.history.length > 1) router.back()
  else navigateTo('/')
}

async function toggleSaveAction() {
  try {
    if (saved.value) { await unsaveArticle(id); showSuccess('Removed from shelf') }
    else { await saveArticle(id); showSuccess('On the shelf') }
  } catch { showError('Could not update the shelf') }
}

async function toggleGoodReadAction() {
  const marking = !goodRead.value
  try {
    await toggleGoodRead(id)
    showSuccess(marking ? 'Marked as a good read' : 'Good-read mark removed')
  } catch { showError('Could not update good reads') }
}

async function elevateAction() {
  if (!personal.value || elevating.value) return
  elevating.value = true
  try {
    await elevate(id)
    markAsRead(id, true).catch(() => {})
    showSuccess('Elevated to SFL')
  } catch {
    showError('Could not reach SFL')
  } finally {
    elevating.value = false
  }
}

async function markReadAndReturn() {
  if (markingRead.value) return
  markingRead.value = true
  try {
    await markAsRead(id, true)
    goBack()
  } catch {
    showError('Could not mark as read')
    markingRead.value = false
  }
}

function openOriginal() {
  if (article.value?.url) window.open(article.value.url, '_blank', 'noopener')
}

function shareTo(target: 'x' | 'threads') {
  const url = article.value?.url
  if (!url) return
  const title = article.value?.title
  const intent = target === 'x' ? xShareUrl(title, url) : threadsShareUrl(url)
  window.open(intent, '_blank', 'noopener')
}

function onKey(e: KeyboardEvent) {
  if (e.metaKey || e.ctrlKey || e.altKey) return
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
  if (e.target instanceof HTMLElement && e.target.isContentEditable) return
  // The note and RSVP overlays own their own keys while open.
  if (noteOverlay.value || rsvpOpen.value) return
  if (popover.value) {
    if (e.key === 'Escape') { e.preventDefault(); popover.value = null }
    return
  }
  // While the voice is reading, space and the horizontal arrows drive it,
  // and Esc stops the voice before it would navigate back.
  if (readAloud.value !== 'idle') {
    if (e.key === ' ') { e.preventDefault(); pauseResumeReadAloud(); return }
    if (e.key === 'ArrowLeft') { e.preventDefault(); skipTtsChunk(-1); return }
    if (e.key === 'ArrowRight') { e.preventDefault(); skipTtsChunk(1); return }
    if (e.key === 'Escape') { e.preventDefault(); stopReadAloud(); return }
  }
  if (e.key === 'Escape' || e.key === 'Backspace') { e.preventDefault(); goBack() }
  else if (e.key === 's') toggleSaveAction()
  else if (e.key === 'r') markReadAndReturn()
  else if (e.key === 'e') elevateAction()
  else if (e.key === 'v') openOriginal()
  else if (e.key === 'g') toggleGoodReadAction()
  else if (e.key === 'h') startHighlight()
  else if (e.key === 'w') openRsvp()
  else if (e.key === 'l') toggleReadAloud()
}

// Reading progress (0–100), driven by how far the page has scrolled.
const scrollPercent = ref(0)
function updateProgress() {
  // Read the scroll position defensively: normally the viewport scrolls
  // (window.scrollY), but a stray overflow on html/body can move the scroll
  // onto documentElement or body instead — so fall back across all three.
  const doc = document.documentElement
  const scrollTop = window.scrollY || doc.scrollTop || document.body.scrollTop || 0
  const scrollHeight = Math.max(doc.scrollHeight, document.body.scrollHeight)
  const max = scrollHeight - window.innerHeight
  scrollPercent.value = max > 0 ? Math.min(100, Math.max(0, (scrollTop / max) * 100)) : 0
}

// Hide the selection pill once the viewport shifts under it, advance the
// rail, and note the new place for the (debounced) position save.
function onScroll() {
  pill.value = null
  updateProgress()
  scheduleProgressSave()
}

// The body height changes when the full-text upgrade re-renders — re-measure.
watch(sanitizedContent, () => nextTick().then(updateProgress))

onMounted(() => {
  window.addEventListener('keydown', onKey)
  document.addEventListener('selectionchange', onSelect)
  window.addEventListener('scroll', onScroll, true)
  window.addEventListener('resize', updateProgress)
  document.addEventListener('visibilitychange', onVisibilityChange)
  updateProgress()
})
onUnmounted(() => {
  window.removeEventListener('keydown', onKey)
  document.removeEventListener('selectionchange', onSelect)
  window.removeEventListener('scroll', onScroll, true)
  window.removeEventListener('resize', updateProgress)
  document.removeEventListener('visibilitychange', onVisibilityChange)
  persistProgress()
  stopReadAloud()
})
</script>
