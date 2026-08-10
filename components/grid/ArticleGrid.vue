<template>
  <div class="relative h-full">
    <div ref="scroller" class="h-full overflow-y-auto overscroll-contain">
      <!--
        Each cell is horizontally draggable (drag="x") while touch-action:
        pan-y leaves vertical pans to the native scroller — the gesture split
        that lets one surface both scroll and swipe. Each cell owns its own
        MotionValue (xFor), so a committed card can fling off while the next
        swipe starts immediately — commits overlap instead of queueing.
        The v-for runs over the stable slot list (slotArticles), not the live
        pool: a committed card's slot is backfilled in place, so nothing
        reflows and no move transition is needed.
      -->
      <!-- Single column on phones (wider rows read + sort easier), 3-col ≥sm -->
      <div class="grid grid-cols-1 gap-3 pb-6 sm:grid-cols-3">
        <motion.div
          v-for="article in slotArticles"
          :key="article.id"
          class="relative"
          :class="dragId === article.id || exiting.has(article.id) ? 'z-20' : undefined"
          style="touch-action: pan-y;"
          :style="{ x: xFor(article.id) }"
          :drag="exiting.has(article.id) ? false : 'x'"
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
      </div>

      <!-- Infinite-scroll sentinel: exists only while the server has more -->
      <div v-if="hasMore" ref="sentinel" class="h-px" aria-hidden="true" />
      <div v-if="loadingMore" class="py-4 text-center">
        <MonoLabel dash>Loading&hellip;</MonoLabel>
      </div>

      <!-- Mark the whole scope (feed / tag / everything) read — the parent
           owns the API call; the count keeps going server-side even past
           unfetched pages. -->
      <div v-if="slotArticles.length" class="flex justify-center pb-8 pt-2">
        <ActionLabel :disabled="markingAll" @click="emit('markAllRead')">
          {{ markingAll ? 'Marking…' : 'Mark all read' }}
        </ActionLabel>
      </div>

      <div v-if="slotArticles.length === 0" class="flex h-full items-center justify-center">
        <DeckEmptyState />
      </div>
    </div>

    <UndoToast :visible="undoVisible" :label="undoLabel" @undo="performUndo" />
  </div>
</template>

<script setup lang="ts">
// ref/watch imported explicitly (not relying on Nuxt auto-imports) so the
// component also resolves under Jest. Harmless under Nuxt.
import { ref, watch, computed, onUnmounted } from 'vue'
import { motion, motionValue, animate } from 'motion-v'
import type { MotionValue, PanInfo } from 'motion-v'
import type { Article } from '~/types'
import { GRID, resolveGridDirection, syncSlots, backfillSlot, restoreSlot, type GridDirection } from '~/utils/grid'
import { DECK } from '~/utils/deck'

const props = defineProps<{
  articles: Article[]
  hasMore: boolean
  loadingMore: boolean
  markingAll?: boolean
}>()
const emit = defineEmits<{ loadMore: []; markAllRead: [] }>()

const { saveArticle, unsaveArticle } = useSavedArticles()
const { markAsRead } = useArticles()
const { showError } = useToast()

/* ── Stable slots ──────────────────────────────────────────────────── */
// The grid renders a slot list, not the live pool: swiping a card away must
// not shift every card below it up one. Instead the vacated slot is refilled
// in place by the LAST slotted article (the one furthest down the feed) via
// backfillSlot — calm beats strict chronology in a survey view. syncSlots
// reconciles against the pool: committed cards drop out, new pool rows
// (loadMore pages, a sync's arrivals, an undone card mid-restore) append at
// the end where nothing moves.
const slotIds = ref<number[]>(props.articles.map((a) => a.id))
watch(() => props.articles, (pool) => {
  slotIds.value = syncSlots(slotIds.value, pool.map((a) => a.id))
})
const slotArticles = computed(() => {
  const byId = new Map(props.articles.map((a) => [a.id, a]))
  return slotIds.value.map((id) => byId.get(id)).filter((a): a is Article => !!a)
})

/* ── Drag physics ──────────────────────────────────────────────────── */
// One MotionValue PER CARD, created lazily on first bind. A committing card
// flings out on its own value, so the next swipe can start immediately —
// nothing is shared between gestures. Entries are dropped after the commit
// so an undone card re-enters at x = 0.
const xMap = new Map<number, MotionValue<number>>()
function xFor(id: number): MotionValue<number> {
  let v = xMap.get(id)
  if (!v) {
    v = motionValue(0)
    xMap.set(id, v)
  }
  return v
}

const dragId = ref<number | null>(null)
const pending = ref<GridDirection | null>(null)
const pendingProgress = ref(0)
// Cards currently mid-commit (flinging out). Guards double-commits on the
// SAME card only — other cards stay fully interactive.
const exiting = ref<Set<number>>(new Set())
const movedFar = ref(false)

function onPointerDown(article: Article) {
  if (exiting.value.has(article.id)) return
  dragId.value = article.id
  movedFar.value = false
}

function onDragStart(article: Article) {
  if (dragId.value !== article.id) return
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
    if (dragId.value === article.id) dragId.value = null
    await settleWithin(animate(xFor(article.id), 0, DECK.SPRING))
  }
}

function onTap(article: Article) {
  if (movedFar.value || exiting.value.has(article.id)) return
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
 * Fling the card off horizontally on its own MotionValue, then swap the slot
 * (backfillSlot pulls the last slotted article into the vacated position —
 * nothing else moves) and perform the optimistic verb. The card's map entry
 * is dropped afterwards so an undone card re-enters at rest. Only the SAME
 * card is guarded against a double-commit — swipes on other cards run
 * concurrently. Exposed for tests (the gesture path funnels here).
 */
async function commitCard(id: number, dir: GridDirection, vx = 0) {
  if (exiting.value.has(id)) return
  exiting.value = new Set(exiting.value).add(id)
  if (dragId.value === id) dragId.value = null
  try {
    const w = typeof window === 'undefined' ? 800 : window.innerWidth
    await settleWithin(animate(xFor(id), dir === 'left' ? -w : w, { ...GRID.FLING, velocity: vx }))
    const slotIndex = slotIds.value.indexOf(id)
    const { slots, movedId } = backfillSlot(slotIds.value, id)
    slotIds.value = slots
    if (dir === 'left') {
      markAsRead(id, true).catch(() => showError('Mark-read failed'))
      showUndo('Read')
    } else {
      saveArticle(id).catch(() => showError('Save failed'))
      showUndo('Save')
    }
    history.value = [...history.value, { id, action: dir, slotIndex, movedId }]
  } finally {
    xMap.delete(id)
    const next = new Set(exiting.value)
    next.delete(id)
    exiting.value = next
  }
}

/* ── Undo ──────────────────────────────────────────────────────────── */
// Grid-local history. Each entry carries the slot swap (slotIndex + which id
// backfilled it) so undo restores the exact picture: the card returns to its
// original slot and the backfill goes back to the end (restoreSlot). The
// slot restore happens BEFORE the API call — the id sits in slotIds while
// the pool still lacks it (slotArticles filters it out), and when the
// optimistic store update returns the article to the pool, syncSlots keeps
// it where restoreSlot put it instead of appending it.
const history = ref<Array<{ id: number; action: GridDirection; slotIndex: number; movedId: number | null }>>([])
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
  undoVisible.value = false
  const entry = history.value[history.value.length - 1]
  if (!entry) return
  history.value = history.value.slice(0, -1)
  slotIds.value = restoreSlot(slotIds.value, entry.id, entry.slotIndex, entry.movedId)
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
