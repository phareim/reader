<template>
  <main class="mx-auto flex h-dvh max-w-xl flex-col px-4 pb-16 pt-4">
    <header class="flex items-baseline justify-between pb-3">
      <MonoLabel dash>{{ props.tag ?? 'The Reader' }}</MonoLabel>
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

    <HelpOverlay :open="helpOpen" @close="helpOpen = false" />
  </main>
</template>

<script setup lang="ts">
import type { Article } from '~/types'

const props = defineProps<{ tag?: string }>()
const emit = defineEmits<{ notFound: [] }>()

const { fetchArticles, unreadArticles } = useArticles()
const { fetchSavedArticleIds } = useSavedArticles()
const { syncAll: syncFeeds } = useFeeds()
const { showSuccess, showError } = useToast()

const stack = ref()
const syncing = ref(false)
const helpOpen = ref(false)

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

const loadArticles = () => fetchArticles(undefined, undefined, props.tag)

onMounted(async () => {
  let is404 = false
  try {
    await Promise.all([loadArticles(), fetchSavedArticleIds()])
    refillDeck()
  } catch (err: any) {
    if (err?.statusCode === 404) { is404 = true; emit('notFound') }
  } finally {
    if (!is404) loaded.value = true
  }
})

async function syncAll() {
  syncing.value = true
  try {
    await syncFeeds()
    await loadArticles()
    refillDeck()
    showSuccess('Feeds synced')
  } catch (err: any) {
    if (err?.statusCode === 404) { emit('notFound'); return }
    showError('Sync failed')
  } finally {
    syncing.value = false
  }
}

// Deck keyboard verbs. Shift is deliberately NOT in the modifier guard:
// '?' requires shift, and shift+R is the sync-all chord.
function onKey(e: KeyboardEvent) {
  if (e.metaKey || e.ctrlKey || e.altKey) return
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
  if (e.target instanceof HTMLElement && e.target.isContentEditable) return
  if (helpOpen.value && e.key === 'Escape') {
    helpOpen.value = false
    return
  }
  const map: Record<string, string> = {
    ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down',
  }
  if (map[e.key]) {
    e.preventDefault()
    stack.value?.commit(map[e.key])
  } else if (e.key === 'u') {
    stack.value?.undo()
  } else if (e.key === '?') {
    helpOpen.value = !helpOpen.value
  } else if (e.key === 'o' || e.key === 'Enter') {
    // Ask the stack for its live top card — the local deckArticles snapshot
    // goes stale as soon as the first commit removes a card.
    stack.value?.openTop()
  } else if (e.key === 'R' && e.shiftKey) {
    syncAll()
  }
}
onMounted(() => window.addEventListener('keydown', onKey))
onUnmounted(() => window.removeEventListener('keydown', onKey))
</script>
