<template>
  <!--
    fixed inset-0 (not h-dvh in flow): the deck screen contributes no document
    height, so the page itself can never scroll — no iOS rubber-band, no
    URL-bar collapse creep. Grid mode scrolls inside its own scroller.
  -->
  <main class="fixed inset-0 mx-auto flex max-w-xl flex-col overflow-hidden overscroll-none px-4 pb-16 pt-4">
    <header class="flex items-baseline justify-between pb-3">
      <MonoLabel dash>{{ props.title ?? props.tag ?? 'The Reader' }}</MonoLabel>
      <span v-if="!signedOut" class="flex items-baseline gap-3">
        <ClientOnly>
          <span class="flex items-baseline gap-1.5" role="group" aria-label="View mode">
            <button
              class="view-toggle font-mono uppercase"
              :class="viewMode === 'deck' ? 'border-b border-ink text-ink' : 'border-b border-transparent text-mute'"
              @click="setViewMode('deck')"
            >Deck</button>
            <span class="view-toggle text-mute">/</span>
            <button
              class="view-toggle font-mono uppercase"
              :class="viewMode === 'grid' ? 'border-b border-ink text-ink' : 'border-b border-transparent text-mute'"
              @click="setViewMode('grid')"
            >Grid</button>
          </span>
        </ClientOnly>
        <MonoLabel>{{ headerCount }} unread</MonoLabel>
      </span>
    </header>
    <HairlineRule />

    <div class="relative min-h-0 flex-1 py-4">
      <ClientOnly>
        <!-- Signed out: a calm doorstep instead of an inexplicably empty deck.
             Gated on `checked` so it never flashes during the session fetch. -->
        <div v-if="signedOut" class="flex h-full flex-col items-center justify-center gap-6 text-center">
          <p class="max-w-xs italic leading-relaxed text-mute">
            A calm reader for your feeds, saved articles, and highlights.
          </p>
          <ActionLabel accent @click="goLogin">Sign in</ActionLabel>
        </div>
        <template v-else-if="loaded">
          <CardStack
            v-if="viewMode === 'deck'"
            ref="stack"
            :articles="deckArticles"
            :syncing="syncing"
            :can-elevate="personal"
            :no-feeds="!props.tag && !props.feedId && feedsLoaded && feeds.length === 0"
            @sync="syncAll"
            @count="unreadCount = $event"
          />
          <ArticleGrid
            v-else
            ref="grid"
            :articles="gridArticles"
            :has-more="hasMore"
            :loading-more="loadingMore"
            :syncing="syncing"
            @load-more="loadMoreArticles"
            @sync="syncAll"
          />
        </template>
        <div v-else class="flex h-full items-center justify-center">
          <MonoLabel dash>Loading&hellip;</MonoLabel>
        </div>
      </ClientOnly>
    </div>

    <HelpOverlay :open="helpOpen" :mode="viewMode" @close="helpOpen = false" />
  </main>
</template>

<script setup lang="ts">
import type { Article } from '~/types'

const props = defineProps<{ tag?: string; feedId?: number; title?: string }>()
const emit = defineEmits<{ notFound: [] }>()

const { fetchArticles, loadMoreArticles, unreadArticles, articles, total, hasMore, loadingMore } = useArticles()
const { fetchSavedArticleIds, savedArticleIds } = useSavedArticles()
const { syncAll: syncFeeds, feeds, fetchFeeds } = useFeeds()
const { viewMode, setViewMode } = useViewMode()
const { personal, loggedIn, checked } = useAuth()

// "Definitely signed out" (session check done, no user) — drives the
// doorstep state and hides the deck chrome that only makes sense signed in.
const signedOut = computed(() => checked.value && !loggedIn.value)
const goLogin = () => navigateTo('/login')
const { showSuccess, showError } = useToast()

const stack = ref()
const grid = ref()
const syncing = ref(false)
const helpOpen = ref(false)

// SNAPSHOT, deliberately not the live `unreadArticles` computed: markAsRead
// optimistically flips isRead, which would shrink a computed deck on every
// read-swipe, retrigger CardStack's refill watcher, and wipe the deck +
// undo history mid-session. The deck refills only on load, explicit sync,
// and returning from the grid (all explicit boundaries).
const deckArticles = ref<Article[]>([])
const unreadCount = ref(0) // kept live by CardStack's @count emit
const loaded = ref(false) // gate CardStack so its empty state never flashes pre-fetch
const feedsLoaded = ref(false) // gate the zero-feeds empty state the same way

// The grid, by contrast, binds the LIVE list: a card marked read or saved
// SHOULD leave a survey view, and undo re-inserts it automatically. Saved
// articles are filtered too because the server excludes them (excludeSaved),
// so a saved (right-swiped) card must not linger.
const gridArticles = computed(() =>
  unreadArticles.value.filter((a) => !savedArticleIds.value.has(a.id)) as Article[]
)

// Grid header count: the server total minus everything fetched-then-consumed
// locally — honest about unfetched pages, live as cards leave. Clamped so a
// stale total can never undercount what is actually on screen.
const gridCount = computed(() => {
  const consumed = articles.value.length - gridArticles.value.length
  return Math.max(gridArticles.value.length, total.value - consumed)
})
const headerCount = computed(() =>
  viewMode.value === 'deck' ? unreadCount.value : gridCount.value
)

function refillDeck() {
  deckArticles.value = [...unreadArticles.value] as Article[]
}

// Re-snapshot when returning from the grid so grid verbs (reads/saves) are
// reflected in the deck — same explicit-boundary rule as load and sync.
watch(viewMode, (mode) => {
  if (mode === 'deck' && loaded.value) refillDeck()
})

const loadArticles = () => fetchArticles(props.feedId, undefined, props.tag)

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
  // Best-effort, after the deck: only needed to tell "no sources yet"
  // apart from "all caught up" in the empty state.
  fetchFeeds().catch(() => {}).finally(() => { feedsLoaded.value = true })
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
  if (viewMode.value === 'grid') {
    // Grid mode: vertical belongs to scrolling — arrows and o/Enter stay
    // native (no preventDefault), there is no top card for them to act on.
    if (e.key === 'u') {
      grid.value?.undo()
    } else if (e.key === '?') {
      helpOpen.value = !helpOpen.value
    } else if (e.key === 'R' && e.shiftKey) {
      syncAll()
    } else if (e.key === '/') {
      e.preventDefault()
      navigateTo('/search')
    }
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
    // Ask the stack for its live top card — the page's deck snapshot
    // goes stale as soon as the first commit removes a card.
    stack.value?.openTop()
  } else if (e.key === 'R' && e.shiftKey) {
    syncAll()
  } else if (e.key === '/') {
    e.preventDefault()
    navigateTo('/search')
  }
}
onMounted(() => window.addEventListener('keydown', onKey))
onUnmounted(() => window.removeEventListener('keydown', onKey))
</script>

<style scoped>
.view-toggle {
  font-size: 10px;
  letter-spacing: 0.16em;
}
button.view-toggle:focus-visible {
  outline: 1px solid var(--tufte-accent);
}
</style>
