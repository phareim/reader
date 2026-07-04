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
        <ActionLabel :accent="saved" :aria-label="saved ? 'Saved' : 'Save'" @click="toggleSaveAction">
          <template #icon>
            <svg width="14" height="14" viewBox="0 0 24 24" :fill="saved ? 'currentColor' : 'none'" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M6 4h12v16l-6-4-6 4z" /></svg>
          </template>
          {{ saved ? 'Saved' : 'Save' }}
        </ActionLabel>
        <ActionLabel aria-label="Elevate" :disabled="elevating" @click="elevateAction">
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
      <!-- Mark-as-read sits inline with the two share buttons. The share
           buttons (public web-intent compose URLs) stay non-accent so the
           single crimson stays on "Mark as read"; brand glyphs render on
           every width. -->
      <div class="flex items-center justify-center gap-3 pb-24">
        <ActionLabel accent :disabled="markingRead" @click="markReadAndReturn">
          {{ markingRead ? 'Marking…' : 'Mark as read' }}
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
         floats in the right gutter, vertically centered on the selection —
         iOS's native callout hugs the selection's horizontal center (above or
         below it), so the right edge is the one spot it never occupies. With
         a mouse it sits below the selection center. mousedown.prevent keeps
         the native selection from collapsing before the click lands. -->
    <div
      v-if="pill"
      class="fixed z-40"
      :class="pill.side === 'right' ? '-translate-y-1/2' : '-translate-x-1/2 pt-2'"
      :style="pill.side === 'right'
        ? { right: '10px', top: pill.y + 'px' }
        : { left: pill.x + 'px', top: pill.y + 'px' }"
      @mousedown.prevent
    >
      <ActionLabel accent @click="startHighlight">Highlight</ActionLabel>
    </div>

    <HighlightNoteOverlay
      v-if="noteOverlay"
      :quote="noteOverlay.quote"
      :saving="savingNote"
      @save="saveHighlight"
      @close="noteOverlay = null"
    />

    <HighlightPopover
      v-if="popover"
      :highlight="popover.highlight"
      :x="popover.x"
      :y="popover.y"
      :source-url="article?.url"
      @remove="removeHighlight"
      @close="popover = null"
    />
  </main>
</template>

<script setup lang="ts">
import { formatRelativeDate } from '~/utils/formatDate'
import { stripHtml } from '~/utils/cardData'
import { processArticleContent } from '~/utils/processArticleContent'
import { looksLikePlainText } from '~/utils/paragraphize'
import { looksTruncated } from '~/utils/truncation'
import { getSelectionOffsets, paintHighlight, unpaint, clearHighlights } from '~/utils/highlightDom'
import { shouldRestorePosition, restoreScrollTop, progressWorthSaving } from '~/utils/readingPosition'
import { xShareUrl, threadsShareUrl } from '~/utils/share'
import type { Highlight } from '~/composables/useHighlights'

const route = useRoute()
const router = useRouter()
const id = Number(route.params.id)

const { isSaved, saveArticle, unsaveArticle, fetchSavedArticleIds } = useSavedArticles()
const { elevate } = useElevate()
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
const pill = ref<{ side: 'right' | 'below'; x: number; y: number } | null>(null)
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
      // Touch: right gutter, vertically centered on the selection — clear of
      // the native callout, which tracks the selection's horizontal center.
      // Clamp so tall selections near an edge keep the pill on-screen.
      pill.value = {
        side: 'right',
        x: 0,
        y: Math.min(Math.max(rect.top + rect.height / 2, 48), window.innerHeight - 48),
      }
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
const relativeDate = computed(() =>
  article.value?.publishedAt ? formatRelativeDate(article.value.publishedAt) : ''
)
const sanitizedContent = computed(() =>
  processArticleContent(article.value?.content) ?? ''
)

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

async function elevateAction() {
  if (elevating.value) return
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
    navigateTo('/')
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
  // The note overlay owns its own keys while open.
  if (noteOverlay.value) return
  if (popover.value) {
    if (e.key === 'Escape') { e.preventDefault(); popover.value = null }
    return
  }
  if (e.key === 'Escape' || e.key === 'Backspace') { e.preventDefault(); goBack() }
  else if (e.key === 's') toggleSaveAction()
  else if (e.key === 'r') markReadAndReturn()
  else if (e.key === 'e') elevateAction()
  else if (e.key === 'v') openOriginal()
  else if (e.key === 'h') startHighlight()
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
})
</script>
