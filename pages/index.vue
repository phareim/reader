<template>
  <div class="min-h-screen bg-paper text-ink font-serif">
    <!-- Hamburger Menu (reskinned by the shell agent) -->
    <HamburgerMenu ref="hamburgerMenuRef" />

    <!-- Keyboard Shortcuts Help Dialog (reskinned by the common agent) -->
    <KeyboardShortcutsHelp ref="helpDialogRef" />

    <!-- Newsletter Summary Modal -->
    <ClientOnly>
      <NewsletterModal />
    </ClientOnly>

    <!-- Main Content Area -->
    <div
      class="min-h-screen transition-all duration-300 ease-in-out"
      :style="{ marginLeft: menuIsOpen ? '20rem' : '0' }"
    >
      <!-- Sticky Header -->
      <PageHeader
        :menu-is-open="menuIsOpen"
        :current-article="null"
        :selected-feed="selectedFeed"
        :selected-feed-id="selectedFeedId"
        :selected-tag="selectedTag"
        :unread-count="articleCounts.unreadCount"
        :total-count="articleCounts.totalCount"
        :is-loading="feedsLoading || articlesLoading"
        @toggle-menu="toggleMenu"
        @mark-all-read="handleMarkAllRead"
        @refresh-feed="handleRefreshFeed"
        @sync-all="handleSyncAll"
        @view-saved="handleViewSaved"
        @sign-out="handleSignOut"
        @success="handleHeaderSuccess"
        @error="handleHeaderError"
      />

      <!-- Success/Error Messages -->
      <div v-if="headerSuccess || headerError" class="px-6 py-4">
        <p v-if="headerSuccess" class="font-serif text-[14px] text-rust">{{ headerSuccess }}</p>
        <p v-if="headerError" class="font-serif text-[14px] italic text-mute">{{ headerError }}</p>
      </div>

      <!-- Not Logged In Entrance -->
      <div v-if="!loggedIn" class="flex flex-col items-center justify-center px-6 py-24 text-center">
        <OrbitalGlyph :size="72" />
        <SerifHeadline level="h1" class="mt-8">Hello.</SerifHeadline>
        <p class="mt-3 max-w-md font-serif text-[14px] leading-[1.55] text-mute">
          Your friendly librarian for organizing and curating the web's knowledge.
        </p>
        <div class="mt-8">
          <ActionLabel label="SIGN IN" accent @click="goToLogin" />
        </div>
      </div>

      <!-- Logged In: the reading deck -->
      <template v-else>
        <div v-if="articlesLoading" class="px-6 py-24 text-center">
          <span class="font-serif text-[14px] italic text-mute">Loading…</span>
        </div>

        <div v-else class="py-10">
          <CardStack
            ref="cardStackRef"
            :articles="deckArticles"
            :syncing="syncing"
            @sync-all="handleSyncAll"
            @open="openArticle"
            @success="handleHeaderSuccess"
            @error="handleHeaderError"
          />
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useKeyboardShortcuts } from '~/composables/useKeyboardShortcuts'
import NewsletterModal from '~/components/common/NewsletterModal.vue'
import type { Article } from '~/types'

const { loggedIn } = useAuth()

const {
  selectedFeedId,
  selectedTag,
  selectedFeed,
  selectedTagFeedIds,
  loading: feedsLoading,
  fetchFeeds,
  refreshFeed,
  syncAll,
} = useFeeds()

const {
  articles,
  selectedArticleId,
  showUnreadOnly,
  displayedArticles,
  unreadArticles,
  loading: articlesLoading,
  fetchArticles,
  markAsRead,
} = useArticles()

// Common page functionality (menu, auth, etc.)
const {
  hamburgerMenuRef,
  helpDialogRef,
  menuIsOpen,
  toggleMenu,
  handleSyncAll: _handleSyncAll,
  handleSignOut,
  initializeArticlePage,
} = useArticlePageCommon()

// Shared article handlers
const { handleMarkAllRead: _handleMarkAllRead } = useArticleViewHandlers()

const handleMarkAllRead = async () => {
  if (selectedFeedId.value !== null && selectedFeedId.value > 0) {
    await _handleMarkAllRead(selectedFeedId.value)
  } else {
    await _handleMarkAllRead()
  }
}

// Header messages
const {
  success: headerSuccess,
  error: headerError,
  showSuccess: handleHeaderSuccess,
  showError: handleHeaderError,
} = useToast()

// ---- Deck source: unread, newest first -------------------------------------

const syncing = ref(false)

const deckArticles = computed<Article[]>(() => {
  // The reading deck is always the unread set for the active view, newest first.
  const pool = selectedFeedId.value === -1 ? articles.value : unreadArticles.value
  return [...pool].sort((a, b) => {
    const ta = a.publishedAt ? Date.parse(a.publishedAt) : 0
    const tb = b.publishedAt ? Date.parse(b.publishedAt) : 0
    return tb - ta
  }) as Article[]
})

// Counts for the header
const articleCounts = computed(() => {
  if (selectedFeedId.value === -1) {
    return { unreadCount: 0, totalCount: articles.value.length }
  }
  return { unreadCount: unreadArticles.value.length, totalCount: 0 }
})

// ---- Navigation -------------------------------------------------------------

const goToLogin = () => navigateTo('/login')

const openArticle = (id: number) => {
  navigateTo(`/article/${id}`)
}

const handleSyncAll = async () => {
  syncing.value = true
  try {
    await _handleSyncAll()
    // Refill the deck after a sync.
    await refillDeck()
  } finally {
    syncing.value = false
  }
}

// ---- Deck refill (mirrors the previous index.vue fetch logic) --------------

const refillDeck = async () => {
  const feedId = selectedFeedId.value
  const tag = selectedTag.value

  if (feedId === -2) {
    // Overview mode — treat as "all unread" for the deck entrance.
    await fetchArticles()
    return
  }

  if (feedId === -1) {
    if (tag && tag !== '__saved_untagged__') {
      await fetchArticles(-1, undefined, tag)
    } else if (tag === '__saved_untagged__') {
      await fetchArticles(-1, undefined, '__inbox__')
    } else {
      await fetchArticles(-1)
    }
  } else if (feedId !== null) {
    await fetchArticles(feedId)
  } else if (tag !== null) {
    await fetchArticles(undefined, selectedTagFeedIds.value)
  } else {
    await fetchArticles()
  }
}

// ---- Lifecycle + watches ----------------------------------------------------

onMounted(async () => {
  const init = await initializeArticlePage()
  if (init.allReady) {
    await init.allReady
  }
})

watch(loggedIn, async (isLoggedIn) => {
  if (isLoggedIn) {
    await initializeArticlePage()
  }
})

// Refill the deck whenever the menu changes the selection.
watch([selectedFeedId, selectedTag, showUnreadOnly], async () => {
  await refillDeck()
})

const handleRefreshFeed = async () => {
  if (selectedFeedId.value && selectedFeedId.value > 0) {
    await refreshFeed(selectedFeedId.value)
    await refillDeck()
  }
}

const handleViewSaved = () => {
  selectedFeedId.value = -1
  selectedTag.value = null
}

// ---- Deck handlers exposed to keyboard shortcuts ---------------------------

const cardStackRef = ref<{ commit: (d: string) => void; undo: () => void } | null>(null)

const deckCommit = (direction: 'left' | 'right' | 'up' | 'down') => {
  cardStackRef.value?.commit(direction)
}
const deckUndo = () => {
  cardStackRef.value?.undo()
}

// Register global keyboard shortcuts. The deck handlers are passed through;
// the keyboard agent (Agent E) consumes `deckCommit`/`deckUndo` to bind
// ←→↑↓ + u. Existing j/k/o/m/s/r shortcuts keep working for list pages.
useKeyboardShortcuts({
  helpDialogRef,
  toggleMenu,
  selectedArticleId,
  displayedArticles,
  selectedFeedId,
  showUnreadOnly,
  markAsRead,
  refreshFeed,
  syncAll,
  toggleSaveArticle: async () => {},
  handleMarkAsRead: async () => {},
  handleMarkAllRead,
  // Deck shortcuts (consumed by the extended useKeyboardShortcuts).
  // The composable binds ←→↑↓ + u to these four discrete handlers.
  deckStore: () => deckCommit('left'),
  deckRead: () => deckCommit('right'),
  deckOpen: () => deckCommit('up'),
  deckSkip: () => deckCommit('down'),
  deckUndo,
} as any)
</script>
