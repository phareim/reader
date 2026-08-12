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
      <!--
        The article itself is a swipe surface: a decisive leftward drag flings
        it away — mark read + continue to the next unread, the touch analog of
        the `r` key. drag="x" + touch-action: pan-y leaves vertical pans to
        the native scroller (the grid's gesture split); the deliberately picky
        commit rule (3:1 dominance, long distance, edge-navigation guard)
        lives in utils/readerSwipe.ts. Coarse pointers only — a mouse drag
        over text is a selection, never a swipe. Rightward is constrained to a
        faint elastic give: there is no right verb here.
      -->
      <motion.div
        :style="{ x: swipeX, opacity: swipeOpacity }"
        style="touch-action: pan-y;"
        :drag="swipeDragEnabled ? 'x' : false"
        :drag-constraints="{ right: 0 }"
        :drag-elastic="0.15"
        :drag-momentum="false"
        drag-snap-to-origin
        @pointerdown="onSwipePointerDown"
        @drag="(e: PointerEvent, info: PanInfo) => onSwipeDrag(info)"
        @drag-end="(e: PointerEvent, info: PanInfo) => onSwipeDragEnd(info)"
        @click.capture="onSwipeClickCapture"
      >
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
      </motion.div>

      <!-- Pending-verb label: the deck's left-swipe accent language — fixed
           so it holds still while the article slides out from under it. -->
      <div
        v-if="swipeProgress > 0"
        class="pointer-events-none fixed left-4 top-1/2 z-40 -translate-y-1/2"
        :style="{ opacity: swipeProgress }"
      >
        <ActionLabel accent>Read</ActionLabel>
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
import { motion } from 'motion-v'
import { formatRelativeDate } from '~/utils/formatDate'
import { stripHtml } from '~/utils/cardData'
import { processArticleContent } from '~/utils/processArticleContent'
import { looksLikePlainText } from '~/utils/paragraphize'
import { looksTruncated } from '~/utils/truncation'
import { xShareUrl, threadsShareUrl } from '~/utils/share'
import { tokenizeWords } from '~/utils/rsvp'
import { nextUnreadId, prevUnreadId } from '~/utils/grid'

// Key by path so navigating article → next article mounts a fresh instance
// (Vue Router reuses the component on a param-only change, which would leave
// every ref — body, highlights, progress — pointing at the previous article).
definePageMeta({ key: (route) => route.fullPath })

const route = useRoute()
const router = useRouter()
const id = Number(route.params.id)

const { isSaved, saveArticle, unsaveArticle, fetchSavedArticleIds, savedArticleIds } = useSavedArticles()
const { isGoodRead, seedGoodRead, toggleGoodRead } = useGoodReads()
const { elevate } = useElevate()
const { personal } = useAuth()
const { markAsRead, articles: contextArticles } = useArticles()
const { showSuccess, showError } = useToast()
const { tick } = useHaptics()

const article = ref<any>(null)
const error = ref<string | null>(null)
const fetchingFullText = ref(false)
const elevating = ref(false)
const markingRead = ref(false)

const articleEl = ref<HTMLElement | null>(null)

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

// ── The four surfaces the reader owns ───────────────────────────────────────
// Each is a per-instance composable created and torn down with this page. The
// page keeps only the wiring: which one is allowed to act, and what happens
// after it does.
const {
  pill, noteOverlay, savingNote, popover,
  repaintHighlights, loadHighlights, onSelect, startHighlight, saveHighlight,
  onArticleClick, removeHighlight,
} = useArticleHighlights(id, articleEl)

const {
  readAloud, ttsIndex, ttsCount, ttsProgress,
  toggleReadAloud, pauseResumeReadAloud, skipTtsChunk, stopReadAloud,
} = useReadAloud({ articleEl, article })

const {
  scrollPercent, updateProgress, persistProgress, scheduleProgressSave,
  restoreReadingPosition, onVisibilityChange,
} = useReadingProgress(id, article)

// The swipe surface is disabled while anything else owns the gesture space:
// the voice player's bottom bar, an overlay, a text selection (the pill), or
// an in-flight mark-read.
const {
  swipeX, swipeOpacity, swipeProgress, swipeExiting, dragEnabled: swipeDragEnabled,
  onSwipePointerDown, onSwipeDrag, onSwipeDragEnd, onSwipeClickCapture, fling,
} = useReaderSwipe({
  enabled: computed(() =>
    !markingRead.value &&
    readAloud.value === 'idle' &&
    !noteOverlay.value && !rsvpOpen.value && !popover.value && !pill.value
  ),
  onCommit: (vx) => swipeAway(vx),
})

/**
 * Fling the article off-screen left, mark it read (optimistic, like the
 * deck's left swipe), and continue to the next unread in the deck context —
 * the same continuation as `markReadAndReturn`, with the card physics.
 */
async function swipeAway(vx = 0) {
  if (swipeExiting.value || markingRead.value) return
  markingRead.value = true
  tick()
  markAsRead(id, true).catch(() => showError('Mark-read failed'))
  await fling(vx)
  const nextId = nextUnreadId(contextArticles.value, savedArticleIds.value, id)
  if (nextId !== null) navigateTo(`/article/${nextId}`, { replace: true })
  else goBack()
}

// The body can re-render once (thin-RSS full-text upgrade); re-anchor the
// highlights and re-measure the rail after.
watch(sanitizedContent, () => nextTick().then(repaintHighlights))
watch(sanitizedContent, () => nextTick().then(updateProgress))

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

/**
 * Mark read, then continue to the next unread article in the deck context we
 * came from (home, tag, or feed — whatever list useArticles last fetched).
 * `replace: true` keeps history honest: chaining through five articles still
 * leaves Back pointing at the deck, not a trail of read articles. Opened
 * outside a deck context (shelf, search, deep link) — or with nothing unread
 * left — this falls back to plain going back.
 */
async function markReadAndReturn() {
  if (markingRead.value) return
  markingRead.value = true
  try {
    await markAsRead(id, true)
    const nextId = nextUnreadId(contextArticles.value, savedArticleIds.value, id)
    if (nextId !== null) navigateTo(`/article/${nextId}`, { replace: true })
    else goBack()
  } catch {
    showError('Could not mark as read')
    markingRead.value = false
  }
}

/**
 * j / k step to the next / previous unread article in the deck context
 * without marking anything read. Same `replace: true` rule as `r`: browsing
 * five articles still leaves Back pointing at the deck. Quiet no-op outside
 * a deck context or with nothing else unread.
 */
function goToAdjacent(dir: 1 | -1) {
  const find = dir === 1 ? nextUnreadId : prevUnreadId
  const targetId = find(contextArticles.value, savedArticleIds.value, id)
  if (targetId !== null) navigateTo(`/article/${targetId}`, { replace: true })
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
  else if (e.key === 'r' || e.key === 'x' || e.key === 'e') markReadAndReturn()
  else if (e.key === 'j') goToAdjacent(1)
  else if (e.key === 'k') goToAdjacent(-1)
  else if (e.key === 'E' && e.shiftKey) elevateAction()
  else if (e.key === 'v') openOriginal()
  else if (e.key === 'g') toggleGoodReadAction()
  else if (e.key === 'h') startHighlight()
  else if (e.key === 'w') openRsvp()
  else if (e.key === 'l') toggleReadAloud()
}

// Hide the selection pill once the viewport shifts under it, advance the
// rail, and note the new place for the (debounced) position save.
function onScroll() {
  pill.value = null
  updateProgress()
  scheduleProgressSave()
}

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
