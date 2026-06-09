<template>
  <main class="mx-auto flex h-dvh max-w-xl flex-col px-4 pb-16 pt-4">
    <header class="flex items-baseline justify-between pb-3">
      <MonoLabel dash>The Reader</MonoLabel>
      <MonoLabel>{{ unreadCount }} unread</MonoLabel>
    </header>
    <HairlineRule />

    <div class="relative min-h-0 flex-1 py-4">
      <ClientOnly>
        <CardStack
          v-if="loaded"
          ref="stack"
          :articles="deckArticles"
          :syncing="syncing"
          @sync="syncAll"
          @count="unreadCount = $event"
        />
        <div v-else class="flex h-full items-center justify-center">
          <MonoLabel dash>Loading…</MonoLabel>
        </div>
      </ClientOnly>
    </div>
  </main>
</template>

<script setup lang="ts">
import type { Article } from '~/types'

const { fetchArticles, unreadArticles } = useArticles()
const { fetchSavedArticleIds } = useSavedArticles()
const { syncAll: syncFeeds } = useFeeds()
const { showSuccess, showError } = useToast()

const stack = ref()
const syncing = ref(false)

// SNAPSHOT, deliberately not the live `unreadArticles` computed: markAsRead
// optimistically flips isRead, which would shrink a computed deck on every
// right-swipe, retrigger CardStack's refill watcher, and wipe the deck +
// undo history mid-session. The deck refills only on load and explicit sync.
const deckArticles = ref<Article[]>([])
const unreadCount = ref(0) // kept live by CardStack's @count emit
const loaded = ref(false) // gate CardStack so its empty state never flashes pre-fetch

function refillDeck() {
  deckArticles.value = [...unreadArticles.value] as Article[]
}

onMounted(async () => {
  try {
    await Promise.all([fetchArticles(), fetchSavedArticleIds()])
    refillDeck()
  } finally {
    loaded.value = true
  }
})

async function syncAll() {
  syncing.value = true
  try {
    await syncFeeds()
    await fetchArticles()
    refillDeck()
    showSuccess('Feeds synced')
  } catch {
    showError('Sync failed')
  } finally {
    syncing.value = false
  }
}

// Deck keyboard verbs (full shortcut system arrives in Task 12; arrows live
// here because they belong to the deck).
function onKey(e: KeyboardEvent) {
  if (e.metaKey || e.ctrlKey || e.altKey) return
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
  if (e.target instanceof HTMLElement && e.target.isContentEditable) return
  const map: Record<string, string> = {
    ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down',
  }
  if (map[e.key]) {
    e.preventDefault()
    stack.value?.commit(map[e.key])
  } else if (e.key === 'u') {
    stack.value?.undo()
  }
}
onMounted(() => window.addEventListener('keydown', onKey))
onUnmounted(() => window.removeEventListener('keydown', onKey))
</script>
