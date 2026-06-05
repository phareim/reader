<template>
  <div class="min-h-screen bg-paper text-ink font-serif">
    <!-- Hamburger Menu -->
    <HamburgerMenu ref="hamburgerMenuRef" />

    <!-- Keyboard Shortcuts Help Dialog -->
    <KeyboardShortcutsHelp ref="helpDialogRef" />

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
        :selected-feed-id="feedId"
        :selected-tag="null"
        :is-refreshing="isRefreshing"
        :is-loading="isRefreshing || articlesLoading"
        :unread-count="selectedFeed?.unreadCount || 0"
        @toggle-menu="toggleMenu"
        @mark-all-read="handleMarkAllRead"
        @refresh-feed="handleRefreshFeed"
        @sync-all="handleSyncAll"
        @view-saved="handleViewSaved"
        @sign-out="handleSignOut"
        @success="handleHeaderSuccess"
        @error="handleHeaderError"
      />

      <!-- Reading Column -->
      <div class="mx-auto max-w-2xl px-almanac-gutter py-almanac-gutter">
        <!-- Success/Error Messages -->
        <div v-if="headerSuccess || headerError" class="mb-4">
          <p v-if="headerSuccess" class="mono-label text-rust">{{ headerSuccess }}</p>
          <p v-if="headerError" class="mono-label text-mute">{{ headerError }}</p>
        </div>

        <!-- Loading Skeletons -->
        <div v-if="articlesLoading" class="divide-y divide-rule">
          <ArticleCardSkeleton v-for="i in 8" :key="i" />
        </div>

        <!-- Article Reading Column -->
        <template v-else-if="searchedArticles.length > 0">
          <template v-for="(article, index) in searchedArticles" :key="article.id">
            <SectionDivider v-if="index > 0" />
            <LazyArticleCard
              :article="article"
              :is-selected="selectedArticleId === article.id"
              :is-saved="isSaved(article.id)"
              :show-feed-title="false"
              :all-tags-with-counts="allTagsWithCounts"
              :selection-mode="selectionMode"
              :is-selected-for-bulk="isSelected(article.id)"
              :source-context="`feed/${feedId}`"
              @toggle-save="toggleSaveArticle(article.id)"
              @toggle-read="handleToggleRead(article.id)"
              @update-tags="handleUpdateTags"
              @toggle-selection="handleToggleSelection(article.id, $event)"
            />
          </template>
        </template>

        <!-- Empty State -->
        <div v-else class="flex flex-col items-center justify-center py-24 text-center">
          <OrbitalGlyph :size="56" class="mb-6" />
          <SerifHeadline level="h2" class="mb-2">All caught up</SerifHeadline>
          <p class="font-serif text-[14px] text-mute mb-8 max-w-almanac-measure">
            No unread articles in this feed.
          </p>

          <!-- Feed Statistics -->
          <div v-if="selectedFeed" class="w-full max-w-sm text-left">
            <MonoLabel class="block mb-3">FEED STATISTICS</MonoLabel>
            <div class="space-y-0">
              <SectionDivider />
              <div class="flex items-baseline justify-between py-2">
                <span class="font-serif text-[14px] text-mute">Total articles</span>
                <span class="font-serif text-[18px] text-ink">{{ articles.length }}</span>
              </div>
              <SectionDivider />
              <div class="flex items-baseline justify-between py-2">
                <span class="font-serif text-[14px] text-mute">Unread</span>
                <span class="font-serif text-[18px] text-ink">{{ selectedFeed.unreadCount || 0 }}</span>
              </div>
              <template v-if="selectedFeed.lastFetchedAt">
                <SectionDivider />
                <div class="flex items-baseline justify-between py-2">
                  <span class="font-serif text-[14px] text-mute">Last updated</span>
                  <span class="font-serif text-[14px] text-ink">{{ formatDate(selectedFeed.lastFetchedAt) }}</span>
                </div>
              </template>
              <template v-if="selectedFeed.isActive !== undefined">
                <SectionDivider />
                <div class="flex items-baseline justify-between py-2">
                  <span class="font-serif text-[14px] text-mute">Status</span>
                  <span class="font-serif text-[14px] text-ink">{{ selectedFeed.isActive ? 'Active' : 'Inactive' }}</span>
                </div>
              </template>
            </div>
          </div>

          <div class="flex flex-wrap gap-3 justify-center mt-8">
            <ActionLabel label="SHOW ALL" @click="showUnreadOnly = false" />
            <NuxtLink to="/">
              <ActionLabel label="OTHER FEEDS" />
            </NuxtLink>
          </div>
        </div>

        <!-- Bulk Selection Trigger -->
        <div
          v-if="loggedIn && searchedArticles.length > 0 && !selectionMode"
          class="fixed bottom-6 right-6 z-20"
        >
          <ActionLabel label="SELECT" @click="toggleSelectionMode" />
        </div>

        <!-- Bulk Action Bar (only for authenticated users) -->
        <BulkActionBar
          v-if="loggedIn"
          :selected-count="selectedCount"
          @mark-read="handleBulkMarkRead"
          @save="handleBulkSave"
          @clear="handleBulkClear"
          @exit="handleBulkExit"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useKeyboardShortcuts } from '~/composables/useKeyboardShortcuts'

const route = useRoute()
const router = useRouter()
const feedId = computed(() => parseInt(route.params.id as string))

const { loggedIn, user } = useAuth()

const {
  feeds,
  refreshing: isRefreshing,
  fetchFeeds,
  refreshFeed,
  syncAll
} = useFeeds()

// Compute the selected feed based on the route parameter feedId
const selectedFeed = computed(() =>
  feeds.value.find(f => f.id === feedId.value)
)

// Set up SEO meta tags for better sharing
watch(selectedFeed, (newFeed) => {
  if (newFeed) {
    useSeoMeta({
      title: `${newFeed.title} - The Librarian`,
      description: newFeed.description || `Read articles from ${newFeed.title} on The Librarian`,
      ogTitle: newFeed.title,
      ogDescription: newFeed.description || `Read articles from ${newFeed.title} on The Librarian`,
      ogType: 'website',
      ogUrl: `${window.location.origin}/feed/${newFeed.id}`,
      ogImage: newFeed.faviconUrl,
      twitterCard: 'summary',
      twitterTitle: newFeed.title,
      twitterDescription: newFeed.description || `Read articles from ${newFeed.title} on The Librarian`,
      twitterImage: newFeed.faviconUrl,
    })
  }
}, { immediate: true })

const {
  articles,
  selectedArticleId,
  displayedArticles,
  showUnreadOnly,
  loading: articlesLoading,
  fetchArticles,
  markAsRead,
  markAllAsRead,
  clearArticles
} = useArticles()

const {
  isSaved,
  fetchSavedArticleIds
} = useSavedArticles()

const {
  allTagsWithCounts,
  fetchTags
} = useTags()

const {
  fetchSavedArticlesByTag
} = useSavedArticlesByTag()

// Search functionality
const { searchQuery, filterArticles } = useArticleSearch()

// Apply search filter to displayed articles
const searchedArticles = computed(() => {
  return filterArticles(displayedArticles.value, searchQuery.value)
})

// Shared article handlers
const {
  toggleSaveArticle,
  handleToggleRead,
  handleUpdateTags,
  handleMarkAsRead
} = useArticleViewHandlers()

// Common page functionality (menu, auth, etc.)
const {
  hamburgerMenuRef,
  helpDialogRef,
  menuIsOpen,
  toggleMenu,
  handleSyncAll,
  handleSignOut,
  initializeArticlePage
} = useArticlePageCommon()

// Header messages
const {
  success: headerSuccess,
  error: headerError,
  showSuccess: handleHeaderSuccess,
  showError: handleHeaderError
} = useToast()

// Bulk action handlers
const {
  selectionMode,
  selectedArticleIds,
  selectedCount,
  toggleSelectionMode,
  handleToggleSelection,
  handleBulkMarkRead,
  handleBulkSave,
  handleBulkClear,
  handleBulkExit
} = useBulkActionHandlers({
  searchedArticles,
  showSuccess: handleHeaderSuccess,
  showError: handleHeaderError
})

const { isSelected, toggleSelection } = useBulkSelection()

const formatDate = formatRelativeDate

const handleMarkAllRead = async () => {
  try {
    if (feedId.value !== null) {
      await markAllAsRead(feedId.value)
      handleHeaderSuccess('All articles marked as read')
    }
  } catch (error) {
    console.error('Failed to mark all as read:', error)
    handleHeaderError('Failed to mark all articles as read')
  }
}

const handleRefreshFeed = async () => {
  if (feedId.value && feedId.value > 0) {
    await refreshFeed(feedId.value)
  }
}

const handleViewSaved = () => {
  router.push('/saved')
}

// Load feeds and articles on mount
onMounted(async () => {
  // Start fetching articles immediately - no need to wait for anything!
  const articlesPromise = feedId.value ? fetchArticles(feedId.value) : Promise.resolve()

  // Initialize authenticated features in parallel (non-blocking)
  if (loggedIn.value) {
    initializeArticlePage() // Don't await - let it run in background
  }

  await articlesPromise
})

// Watch for feed ID changes
watch(feedId, async (newFeedId) => {
  if (newFeedId) {
    // IMMEDIATELY clear old articles for instant visual feedback
    clearArticles()
    await fetchArticles(newFeedId)
  }
})

// Register global keyboard shortcuts
useKeyboardShortcuts({
  helpDialogRef,
  toggleMenu,
  selectedArticleId,
  displayedArticles,
  selectedFeedId: feedId,
  showUnreadOnly: computed(() => false),
  markAsRead,
  refreshFeed,
  syncAll,
  toggleSaveArticle,
  handleMarkAsRead,
  handleMarkAllRead,
  selectionMode,
  selectedArticleIds,
  toggleSelection
})
</script>
