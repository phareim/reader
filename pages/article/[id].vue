<template>
  <!-- Reading progress: a hairline-thin rail on the right edge that fills
       downward as the reader scrolls through the article. -->
  <div class="fixed right-0 top-0 z-40 h-screen w-[2px] bg-rule" aria-hidden="true">
    <div class="w-full bg-mute" :style="{ height: scrollPercent + '%' }" />
  </div>

  <main class="mx-auto max-w-measure px-5 py-6">
    <!-- Action row -->
    <div class="flex items-center justify-between">
      <ActionLabel @click="goBack">Back</ActionLabel>
      <div class="flex gap-2">
        <ActionLabel :accent="saved" @click="toggleSaveAction">{{ saved ? 'Saved' : 'Save' }}</ActionLabel>
        <ActionLabel @click="elevateAction" :disabled="elevating">{{ elevating ? 'Elevating…' : 'Elevate' }}</ActionLabel>
        <ActionLabel @click="openOriginal">Original</ActionLabel>
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
      <div class="flex justify-center pb-24">
        <ActionLabel accent :disabled="markingRead" @click="markReadAndReturn">
          {{ markingRead ? 'Marking…' : 'Mark as read' }}
        </ActionLabel>
      </div>
    </template>

    <p v-else-if="error" class="mt-10 italic text-mute">{{ error }}</p>
    <p v-else class="mt-10 italic text-mute">Loading…</p>

    <!-- Floating affordance shown while a passage is selected. mousedown.prevent
         keeps the native selection from collapsing before the click lands. -->
    <div
      v-if="pill"
      class="fixed z-40 -translate-x-1/2 -translate-y-full pb-2"
      :style="{ left: pill.x + 'px', top: pill.y + 'px' }"
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
import { getSelectionOffsets, paintHighlight, unpaint, clearHighlights } from '~/utils/highlightDom'
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
const pill = ref<{ x: number; y: number } | null>(null)
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
  if (rect && rect.width) pill.value = { x: rect.left + rect.width / 2, y: rect.top }
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

/** RSS bodies under ~1200 visible chars are treated as excerpts → fetch full text. */
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
  if (visible.length < THIN_CHARS) {
    fetchingFullText.value = true
    try {
      await $fetch(`/api/articles/${id}/fetch-fulltext`, { method: 'POST' })
      article.value = await $fetch(`/api/articles/${id}`)
    } catch {
      // Keep the excerpt — "Original" is one tap away.
    } finally {
      fetchingFullText.value = false
    }
  } else if (looksLikePlainText(content) && article.value?.fullTextStatus !== 'failed') {
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
  // Measure the viewport scroll (window.scrollY), not documentElement.scrollTop:
  // with overflow-x: hidden on html/body the scroll container that actually
  // owns scrollTop varies by browser, but window.scrollY always tracks the
  // viewport. Document height is still read off documentElement.
  const max = document.documentElement.scrollHeight - window.innerHeight
  scrollPercent.value = max > 0 ? Math.min(100, Math.max(0, (window.scrollY / max) * 100)) : 0
}

// Hide the selection pill once the viewport shifts under it, and advance the rail.
function onScroll() {
  pill.value = null
  updateProgress()
}

// The body height changes when the full-text upgrade re-renders — re-measure.
watch(sanitizedContent, () => nextTick().then(updateProgress))

onMounted(() => {
  window.addEventListener('keydown', onKey)
  document.addEventListener('selectionchange', onSelect)
  window.addEventListener('scroll', onScroll, true)
  window.addEventListener('resize', updateProgress)
  updateProgress()
})
onUnmounted(() => {
  window.removeEventListener('keydown', onKey)
  document.removeEventListener('selectionchange', onSelect)
  window.removeEventListener('scroll', onScroll, true)
  window.removeEventListener('resize', updateProgress)
})
</script>
