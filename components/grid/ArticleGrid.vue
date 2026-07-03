<template>
  <div class="relative h-full">
    <div ref="scroller" class="h-full overflow-y-auto overscroll-contain">
      <!--
        Each cell is horizontally draggable (drag="x") while touch-action:
        pan-y leaves vertical pans to the native scroller — the gesture split
        that lets one surface both scroll and swipe. The shared x MotionValue
        binds only to the active cell (dragId), so a fling never leaks onto a
        recycled row. TransitionGroup's move transition covers the reflow when
        a committed card leaves the live list.
      -->
      <!-- Single column on phones (wider rows read + sort easier), 3-col ≥sm -->
      <TransitionGroup tag="div" name="grid-cards" class="grid grid-cols-1 gap-3 pb-6 sm:grid-cols-3">
        <motion.div
          v-for="article in articles"
          :key="article.id"
          class="relative"
          :class="dragId === article.id ? 'z-20' : undefined"
          style="touch-action: pan-y;"
          :style="dragId === article.id ? { x } : undefined"
          :drag="busy ? false : 'x'"
          :drag-elastic="0.9"
          :drag-momentum="false"
          @pointerdown="onPointerDown(article)"
          @drag-start="onDragStart(article)"
          @drag="(e: PointerEvent, info: PanInfo) => onDrag(article, info)"
          @drag-end="(e: PointerEvent, info: PanInfo) => onDragEnd(article, info)"
          @click="onTap(article)"
        >
          <MiniCard :article="article" class="h-full" />
          <!-- Pending-verb label: the one accent, on the dragged card only -->
          <div
            v-if="dragId === article.id && pending"
            class="pointer-events-none absolute inset-0 z-10 flex items-center justify-center"
            :style="{ opacity: pendingProgress }"
          >
            <ActionLabel accent>{{ pending === 'left' ? 'Read' : 'Save' }}</ActionLabel>
          </div>
        </motion.div>
      </TransitionGroup>

      <!-- Infinite-scroll sentinel: exists only while the server has more -->
      <div v-if="hasMore" ref="sentinel" class="h-px" aria-hidden="true" />
      <div v-if="loadingMore" class="py-4 text-center">
        <MonoLabel dash>Loading&hellip;</MonoLabel>
      </div>

      <div v-if="articles.length === 0" class="flex h-full items-center justify-center">
        <DeckEmptyState :syncing="syncing" @sync="emit('sync')" />
      </div>
    </div>

    <UndoToast :visible="undoVisible" :label="undoLabel" @undo="performUndo" />
  </div>
</template>

<script setup lang="ts">
// ref/watch imported explicitly (not relying on Nuxt auto-imports) so the
// component also resolves under Jest. Harmless under Nuxt.
import { ref, watch, onUnmounted } from 'vue'
import { motion, useMotionValue, animate } from 'motion-v'
import type { PanInfo } from 'motion-v'
import type { Article } from '~/types'
import { GRID, resolveGridDirection, type GridDirection } from '~/utils/grid'
import { DECK } from '~/utils/deck'

const props = defineProps<{
  articles: Article[]
  hasMore: boolean
  loadingMore: boolean
  syncing?: boolean
}>()
const emit = defineEmits<{ loadMore: []; sync: [] }>()

const { saveArticle, unsaveArticle } = useSavedArticles()
const { markAsRead } = useArticles()
const { showError } = useToast()

/* ── Drag physics ──────────────────────────────────────────────────── */
// One shared MotionValue, bound (via :style) to whichever cell owns the
// current gesture. Bound on pointerdown — before any drag movement — so
// motion drives our value from the first pixel.
const x = useMotionValue(0)
const dragId = ref<number | null>(null)
const pending = ref<GridDirection | null>(null)
const pendingProgress = ref(0)
const busy = ref(false)
const movedFar = ref(false)

function onPointerDown(article: Article) {
  if (busy.value) return
  dragId.value = article.id
  movedFar.value = false
}

function onDragStart(article: Article) {
  if (busy.value || dragId.value !== article.id) return
  pending.value = null
  pendingProgress.value = 0
}

function onDrag(article: Article, info: PanInfo) {
  if (dragId.value !== article.id) return
  const dx = info.offset.x
  const dy = info.offset.y
  if (Math.abs(dx) > 8) movedFar.value = true
  // The pending accent mirrors the release rule: a diagonal pointer is a
  // scroll, not a swipe, so the verb label must not light up for it.
  if (Math.abs(dx) > 4 && Math.abs(dx) >= Math.abs(dy) * GRID.DOMINANCE_RATIO) {
    pending.value = dx < 0 ? 'left' : 'right'
    pendingProgress.value = Math.min(1, Math.abs(dx) / GRID.DISTANCE_THRESHOLD)
  } else {
    pending.value = null
    pendingProgress.value = 0
  }
}

async function onDragEnd(article: Article, info: PanInfo) {
  if (dragId.value !== article.id) return
  pending.value = null
  pendingProgress.value = 0
  // Defer the tap-guard reset so the click event (which fires after dragEnd)
  // still sees movedFar=true and ignores the tap.
  setTimeout(() => { movedFar.value = false }, 0)
  const dir = resolveGridDirection(info.offset.x, info.offset.y, info.velocity.x)
  if (dir) {
    await commitCard(article.id, dir, info.velocity.x)
  } else {
    await settleWithin(animate(x, 0, DECK.SPRING))
    if (dragId.value === article.id && !busy.value) dragId.value = null
  }
}

function onTap(article: Article) {
  if (movedFar.value || busy.value) return
  navigateTo(`/article/${article.id}`)
}

/* ── Commits ───────────────────────────────────────────────────────── */

// Same safety net as CardStack: motion-dom's JSAnimation never resolves
// `finished` when stopped, so a bare await could wedge `busy` forever.
const ANIMATION_SAFETY_MS = 1200
function settleWithin(p: Promise<unknown>, ms = ANIMATION_SAFETY_MS): Promise<void> {
  return new Promise((resolve) => {
    const t = setTimeout(resolve, ms)
    p.then(
      () => { clearTimeout(t); resolve() },
      () => { clearTimeout(t); resolve() },
    )
  })
}

/**
 * Fling the card off horizontally, then perform the optimistic verb. The
 * store update removes the article from the parent's live list, so the cell
 * leaves the DOM on its own; we reset the MotionValue afterwards so nothing
 * inherits the offset. Exposed for tests (the gesture path funnels here).
 */
async function commitCard(id: number, dir: GridDirection, vx = 0) {
  if (busy.value) return
  busy.value = true
  dragId.value = id
  try {
    const w = typeof window === 'undefined' ? 800 : window.innerWidth
    await settleWithin(animate(x, dir === 'left' ? -w : w, { ...GRID.FLING, velocity: vx }))
    if (dir === 'left') {
      markAsRead(id, true).catch(() => showError('Mark-read failed'))
      showUndo('Read')
    } else {
      saveArticle(id).catch(() => showError('Save failed'))
      showUndo('Save')
    }
    history.value = [...history.value, { id, action: dir }]
  } finally {
    x.set(0)
    dragId.value = null
    busy.value = false
  }
}

/* ── Undo ──────────────────────────────────────────────────────────── */
// Grid-local history — no deck order to restore: undoing the verb flips the
// article back into the live list, which re-inserts the card at its natural
// published-order position.
const history = ref<Array<{ id: number; action: GridDirection }>>([])
const undoVisible = ref(false)
const undoLabel = ref('')
let undoTimer: ReturnType<typeof setTimeout> | null = null

function showUndo(label: string) {
  undoLabel.value = label
  undoVisible.value = true
  if (undoTimer) clearTimeout(undoTimer)
  undoTimer = setTimeout(() => { undoVisible.value = false }, 5000)
}

async function performUndo() {
  if (busy.value) return
  undoVisible.value = false
  const entry = history.value[history.value.length - 1]
  if (!entry) return
  history.value = history.value.slice(0, -1)
  try {
    if (entry.action === 'left') await markAsRead(entry.id, false)
    else await unsaveArticle(entry.id)
  } catch {
    showError('Undo could not reach the server')
  }
}

/* ── Infinite scroll ───────────────────────────────────────────────── */
const scroller = ref<HTMLElement | null>(null)
const sentinel = ref<HTMLElement | null>(null)
let observer: IntersectionObserver | null = null

// The sentinel is v-if'ed on hasMore, so observe/disconnect follows the
// template ref. Parent-side guards (loading/loadingMore/hasMore) make
// duplicate emits harmless.
watch(sentinel, (el) => {
  observer?.disconnect()
  observer = null
  if (!el || typeof IntersectionObserver === 'undefined') return
  observer = new IntersectionObserver(
    (entries) => {
      if (entries.some((e) => e.isIntersecting)) emit('loadMore')
    },
    { root: scroller.value, rootMargin: GRID.SENTINEL_MARGIN },
  )
  observer.observe(el)
}, { flush: 'post' })

// IntersectionObserver only fires on threshold crossings — if the sentinel
// stays inside the margin after a page lands, no new event comes. Re-observe
// when a load finishes so a still-visible sentinel triggers the next page.
watch(() => props.loadingMore, (now, was) => {
  if (was && !now && observer && sentinel.value) {
    observer.unobserve(sentinel.value)
    observer.observe(sentinel.value)
  }
})

onUnmounted(() => {
  observer?.disconnect()
  if (undoTimer) clearTimeout(undoTimer)
})

defineExpose({ undo: performUndo, commitCard })
</script>

<style scoped>
.grid-cards-move {
  transition: transform 0.25s ease;
}
</style>
