<template>
  <div class="mx-auto w-full max-w-[42rem] px-4">
    <!-- Empty state -->
    <DeckEmptyState
      v-if="deck.length === 0"
      :syncing="syncing"
      @sync-all="emit('sync-all')"
    />

    <!-- The stack: top 3 cards as paper sheets -->
    <div v-else class="relative mx-auto" :style="{ height: stackHeight }">
      <div
        v-for="(item, i) in visibleCards"
        :key="item.id"
        class="absolute inset-x-0 top-0"
        :style="sheetStyle(i)"
      >
        <ArticleStackCard
          :article="item.article"
          :is-top="i === 0"
          :top-card-style="i === 0 ? gesture.cardStyle.value : undefined"
          :handlers="i === 0 ? gesture.handlers : undefined"
          :drag-direction="i === 0 ? gesture.direction.value : null"
          :drag-progress="i === 0 ? gesture.progress.value : 0"
        />
      </div>
    </div>

    <!-- On-screen action affordances (the gestures, spelled out) -->
    <div
      v-if="deck.length > 0"
      class="mt-6 flex flex-wrap items-center justify-center gap-3"
    >
      <ActionLabel label="STORE" @click="commit('left')" />
      <ActionLabel label="OPEN" @click="commit('up')" />
      <ActionLabel label="SKIP" @click="commit('down')" />
      <ActionLabel label="READ" accent @click="commit('right')" />
    </div>

    <!-- Undo toast (~5s after a store/read commit) -->
    <UndoToast
      :visible="undoVisible"
      :message="undoMessage"
      @undo="handleUndo"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, onUnmounted } from 'vue'
import type { Article } from '~/types'
import {
  advance,
  undo as undoDeck,
  type DeckDirection,
  type DeckHistoryEntry,
} from '~/utils/deck'
import { useDeckGesture } from '~/composables/useDeckGesture'

/**
 * CardStack — the reading deck. Holds an id deck over the supplied articles,
 * renders the top 3 cards as hairline paper sheets, wires the gesture to the
 * top card, and routes the four commit directions:
 *   left  → store (save)
 *   right → read  (mark read)
 *   up    → open  (reader) — non-destructive
 *   down  → skip          — rotate to back of deck
 * After a store/read commit it surfaces an UndoToast for ~5s.
 *
 * Exposes `commit(direction)` and `undo()` so keyboard shortcuts drive the
 * same path.
 */
const props = defineProps<{
  /** The pool of articles to build the deck from (unread, newest first). */
  articles: readonly Article[]
  syncing?: boolean
}>()

const emit = defineEmits<{
  (e: 'sync-all'): void
  (e: 'open', id: number): void
  (e: 'success', message: string): void
  (e: 'error', message: string): void
}>()

const { saveArticle, unsaveArticle } = useSavedArticles()
const { markAsRead } = useArticles()

// ---- Deck state -------------------------------------------------------------

// The deck is an ordered array of string ids; the article lookup is by id.
const deck = ref<string[]>([])
const history = ref<DeckHistoryEntry[]>([])

const articleById = computed(() => {
  const map = new Map<string, Article>()
  for (const a of props.articles) map.set(String(a.id), a)
  return map
})

// Rebuild the deck whenever the source article set changes (menu selection,
// refill). Newest-first ordering is the responsibility of the caller.
watch(
  () => props.articles.map(a => a.id).join(','),
  () => {
    deck.value = props.articles.map(a => String(a.id))
    history.value = []
    dismissUndo()
  },
  { immediate: true },
)

const visibleCards = computed(() =>
  deck.value
    .slice(0, 3)
    .map(id => ({ id, article: articleById.value.get(id) }))
    .filter((x): x is { id: string; article: Article } => !!x.article),
)

// ---- Layout: sheets peek below the top card ---------------------------------

const PEEK_OFFSET = 8 // px downward per layer
const stackHeight = '32rem'

function sheetStyle(i: number) {
  // Card 0 = top (handled by gesture transform inside the card).
  // Cards 1 & 2 sit below with a small downward offset + reduced opacity.
  const offset = i * PEEK_OFFSET
  const zIndex = 30 - i
  if (i === 0) {
    return { height: stackHeight, zIndex: String(zIndex) }
  }
  return {
    height: stackHeight,
    zIndex: String(zIndex),
    transform: `translateY(${offset}px) scale(${1 - i * 0.02})`,
    opacity: String(1 - i * 0.28),
    transition: 'transform 220ms cubic-bezier(0.22,1,0.36,1), opacity 220ms ease',
  }
}

// ---- Gesture wiring ---------------------------------------------------------

const gestureDisabled = computed(() => deck.value.length === 0)

const gesture = useDeckGesture({
  onCommit: onDirection,
  disabled: gestureDisabled,
})

function commit(dir: DeckDirection) {
  gesture.commit(dir)
}

// ---- Direction routing ------------------------------------------------------

async function onDirection(dir: DeckDirection) {
  const topId = deck.value[0]
  if (!topId) return
  const numericId = Number(topId)

  if (dir === 'up') {
    // Non-destructive: open the reader, leave the deck untouched.
    emit('open', numericId)
    return
  }

  if (dir === 'down') {
    // Skip: rotate to the back. No API call, no undo toast.
    const { deck: next } = advance(deck.value, 'down')
    deck.value = next
    return
  }

  // left = store, right = read — both remove the top card and offer undo.
  const { deck: next, entry } = advance(deck.value, dir === 'left' ? 'left' : 'right')
  deck.value = next
  if (entry) history.value = [...history.value, entry]

  try {
    if (dir === 'left') {
      await saveArticle(numericId)
      showUndo('Stored.')
    } else {
      await markAsRead(numericId, true)
      showUndo('Marked read.')
    }
  } catch (err: any) {
    emit('error', err?.message || 'Action failed')
    // Roll the optimistic deck change back so the card reappears.
    rollbackLast(entry)
  }
}

function rollbackLast(entry: DeckHistoryEntry | null) {
  if (!entry) return
  const restored = undoDeck(deck.value, history.value)
  if (restored) {
    deck.value = restored.deck
    history.value = restored.history
  }
  dismissUndo()
}

// ---- Undo toast -------------------------------------------------------------

const undoVisible = ref(false)
const undoMessage = ref('Done.')
let undoTimer: ReturnType<typeof setTimeout> | null = null

function showUndo(message: string) {
  undoMessage.value = message
  undoVisible.value = true
  if (undoTimer) clearTimeout(undoTimer)
  undoTimer = setTimeout(() => {
    undoVisible.value = false
  }, 5000)
}

function dismissUndo() {
  undoVisible.value = false
  if (undoTimer) {
    clearTimeout(undoTimer)
    undoTimer = null
  }
}

async function handleUndo() {
  const restored = undoDeck(deck.value, history.value)
  dismissUndo()
  if (!restored) return

  const { entry } = restored
  deck.value = restored.deck
  history.value = restored.history

  const numericId = Number(entry.id)
  try {
    if (entry.action === 'left') {
      await unsaveArticle(numericId)
    } else if (entry.action === 'right' || entry.action === 'commit') {
      await markAsRead(numericId, false)
    }
    emit('success', 'Undone.')
  } catch (err: any) {
    emit('error', err?.message || 'Undo failed')
  }
}

onUnmounted(dismissUndo)

// Exposed so the keyboard agent (via index.vue) can drive the deck.
defineExpose({
  commit,
  undo: handleUndo,
})
</script>
