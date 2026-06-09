<template>
  <div class="relative h-full w-full" style="touch-action: none;">
    <!-- Under-cards (depth) + top card (drag) -->
    <template v-for="(article, i) in visibleCards" :key="article.id">
      <!-- Top card -->
      <motion.div
        v-if="i === 0"
        class="absolute inset-0 z-30"
        :style="{ x, y, rotate }"
        drag
        drag-snap-to-origin
        :drag-elastic="0.9"
        :drag-momentum="false"
        :while-press="{ scale: 1.015 }"
        @drag-start="dragging = true"
        @drag="onDrag"
        @drag-end="onDragEnd"
        @click="onTap(article)"
      >
        <ArticleCard :article="article" class="h-full" />
      </motion.div>

      <!-- Under-cards -->
      <motion.div
        v-else
        class="absolute inset-0"
        :class="i === 1 ? 'z-20' : 'z-10'"
        :initial="false"
        :animate="{ scale: 1 - i * 0.03, y: i * 12, opacity: 1 - i * 0.18 }"
        :transition="DECK.SPRING"
        aria-hidden="true"
      >
        <ArticleCard :article="article" class="h-full" />
      </motion.div>
    </template>

    <!-- Pending-verb labels: the one accent, fading in toward commit -->
    <div v-if="dragging" class="pointer-events-none absolute inset-0 z-40">
      <div class="absolute left-4 top-1/2 -translate-y-1/2" :style="{ opacity: pending === 'left' ? pendingProgress : 0 }">
        <ActionLabel accent>Save</ActionLabel>
      </div>
      <div class="absolute right-4 top-1/2 -translate-y-1/2" :style="{ opacity: pending === 'right' ? pendingProgress : 0 }">
        <ActionLabel accent>Read</ActionLabel>
      </div>
      <div class="absolute left-1/2 top-4 -translate-x-1/2" :style="{ opacity: pending === 'up' ? pendingProgress : 0 }">
        <ActionLabel accent>Elevate</ActionLabel>
      </div>
      <div class="absolute bottom-4 left-1/2 -translate-x-1/2" :style="{ opacity: pending === 'down' ? pendingProgress : 0 }">
        <ActionLabel accent>Skip</ActionLabel>
      </div>
    </div>

    <!-- Empty -->
    <div v-if="deckIds.length === 0" class="absolute inset-0 z-0 flex items-center justify-center">
      <DeckEmptyState :syncing="syncing" @sync="emit('sync')" />
    </div>

    <UndoToast :visible="undoVisible" :label="undoLabel" @undo="performUndo" />
  </div>
</template>

<script setup lang="ts">
// ref/computed/watch imported explicitly (not relying on Nuxt auto-imports)
// so the component also resolves under Jest. Harmless under Nuxt.
import { ref, computed, watch } from 'vue'
import { motion, useMotionValue, useTransform, animate } from 'motion-v'
import type { PanInfo } from 'motion-v'
import type { Article } from '~/types'
import {
  DECK,
  resolveDirection,
  advance,
  undo as undoDeck,
  type DeckDirection,
  type DeckHistoryEntry,
} from '~/utils/deck'

const props = defineProps<{ articles: Article[]; syncing?: boolean }>()
const emit = defineEmits<{ sync: []; count: [n: number] }>()

const { saveArticle, unsaveArticle } = useSavedArticles()
const { markAsRead } = useArticles()
const { elevate, unElevate } = useElevate()
const { showError } = useToast()

/* ── Deck state ────────────────────────────────────────────────────── */
const deckIds = ref<string[]>([])
const history = ref<DeckHistoryEntry[]>([])

watch(
  () => props.articles,
  (articles) => {
    // Refill wholesale (initial load / feed sync). Preserves nothing — the
    // deck IS the unread stream, newest first.
    deckIds.value = articles.map((a) => String(a.id))
    history.value = []
  },
  { immediate: true },
)

// The parent header shows the live deck size (the prop is a static snapshot).
watch(deckIds, (ids) => emit('count', ids.length), { immediate: true, deep: true })

const byId = computed(() => new Map(props.articles.map((a) => [String(a.id), a])))
const visibleCards = computed(() =>
  deckIds.value.slice(0, 3).map((id) => byId.value.get(id)!).filter(Boolean),
)

/* ── Drag physics ──────────────────────────────────────────────────── */
const x = useMotionValue(0)
const y = useMotionValue(0)
const rotate = useTransform(x, [-300, 300], [-DECK.MAX_ROTATION, DECK.MAX_ROTATION])

const dragging = ref(false)
const pending = ref<DeckDirection | null>(null)
const pendingProgress = ref(0)
const busy = ref(false)
const movedFar = ref(false)

function onDrag(_e: PointerEvent, info: PanInfo) {
  const { x: dx, y: dy } = info.offset
  if (Math.abs(dx) > 8 || Math.abs(dy) > 8) movedFar.value = true
  const absX = Math.abs(dx)
  const absY = Math.abs(dy)
  if (absX >= absY * DECK.DOMINANCE_RATIO) {
    pending.value = dx < 0 ? 'left' : 'right'
    pendingProgress.value = Math.min(1, absX / DECK.DISTANCE_THRESHOLD)
  } else if (absY >= absX * DECK.DOMINANCE_RATIO) {
    pending.value = dy < 0 ? 'up' : 'down'
    pendingProgress.value = Math.min(1, absY / DECK.DISTANCE_THRESHOLD)
  } else {
    pending.value = null
    pendingProgress.value = 0
  }
}

async function onDragEnd(_e: PointerEvent, info: PanInfo) {
  dragging.value = false
  pending.value = null
  const dir = resolveDirection(info.offset.x, info.offset.y, info.velocity.x, info.velocity.y)
  // Defer the tap-guard reset so the click event (which fires after dragEnd)
  // still sees movedFar=true and ignores the tap.
  setTimeout(() => { movedFar.value = false }, 0)
  if (dir) await commit(dir, { vx: info.velocity.x, vy: info.velocity.y })
  // else: dragSnapToOrigin springs the card home.
}

function onTap(article: Article) {
  if (movedFar.value || busy.value) return
  navigateTo(`/article/${article.id}`)
}

/* ── Commits ───────────────────────────────────────────────────────── */
async function flingOff(dir: DeckDirection, vx = 0, vy = 0) {
  const w = typeof window === 'undefined' ? 800 : window.innerWidth
  const h = typeof window === 'undefined' ? 800 : window.innerHeight
  const target = { left: -w * 1.2, right: w * 1.2, up: -h * 1.1, down: h * 1.1 }[dir]
  const mv = dir === 'left' || dir === 'right' ? x : y
  const velocity = dir === 'left' || dir === 'right' ? vx : vy
  await animate(mv, target, { ...DECK.FLING, velocity })
}

function resetCard() {
  x.set(0)
  y.set(0)
}

async function springBack() {
  await Promise.all([
    animate(x, 0, DECK.SPRING),
    animate(y, 0, DECK.SPRING),
  ])
}

async function commit(dir: DeckDirection, v: { vx: number; vy: number } = { vx: 0, vy: 0 }) {
  if (busy.value || deckIds.value.length === 0) return
  busy.value = true
  const topId = deckIds.value[0]

  try {
    if (dir === 'up') {
      // Non-optimistic: hold the card up while SFL answers.
      await animate(y, -140, DECK.SPRING)
      let result
      try {
        result = await elevate(Number(topId))
      } catch {
        showError('Could not reach SFL — card kept')
        await springBack()
        return
      }
      await flingOff('up', 0, v.vy)
      applyAdvance('up', { ideaId: result.ideaId, ideaExisting: result.existing })
      markAsRead(Number(topId), true).catch(() => {})
      showUndo('Elevate')
    } else if (dir === 'left') {
      await flingOff('left', v.vx)
      applyAdvance('left')
      saveArticle(Number(topId)).catch(() => showError('Save failed'))
      showUndo('Save')
    } else if (dir === 'right') {
      await flingOff('right', v.vx)
      applyAdvance('right')
      markAsRead(Number(topId), true).catch(() => showError('Mark-read failed'))
      showUndo('Read')
    } else {
      await flingOff('down', 0, v.vy)
      applyAdvance('down')
    }
  } finally {
    resetCard()
    busy.value = false
  }
}

function applyAdvance(dir: DeckDirection, extra?: Partial<DeckHistoryEntry>) {
  const { deck, entry } = advance(deckIds.value, dir)
  deckIds.value = deck
  if (entry) history.value = [...history.value, { ...entry, ...extra }]
}

/* ── Undo ──────────────────────────────────────────────────────────── */
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
  const result = undoDeck(deckIds.value, history.value)
  if (!result) return
  deckIds.value = result.deck
  history.value = result.history
  const { entry } = result
  const id = Number(entry.id)
  try {
    if (entry.action === 'left') await unsaveArticle(id)
    else if (entry.action === 'right') await markAsRead(id, false)
    else if (entry.action === 'up') {
      await unElevate(id, entry.ideaId, entry.ideaExisting)
      await markAsRead(id, false)
    }
  } catch {
    showError('Undo could not reach the server')
  }
}

defineExpose({ commit, undo: performUndo })
</script>
