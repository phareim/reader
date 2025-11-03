<template>
  <div class="min-h-screen bg-gray-50 dark:bg-dark-bg">
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

      <!-- Articles List -->
      <div class="py-0">
        <!-- Success/Error Messages -->
        <div v-if="headerSuccess || headerError" class="px-6 py-4">
          <p v-if="headerSuccess" class="text-base text-green-500 dark:text-green-400">{{ headerSuccess }}</p>
          <p v-if="headerError" class="text-base text-red-500 dark:text-red-400">{{ headerError }}</p>
        </div>

        <div v-if="articlesLoading" class="text-center text-gray-500 dark:text-gray-400 py-8">Loading...</div>

        <!-- Article Grid -->
        <div v-else-if="searchedArticles.length > 0" class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 p-4">
          <LazyArticleCard
            v-for="article in searchedArticles"
            :key="article.id"
            :article="article"
            :is-selected="selectedArticleId === article.id"
            :is-saved="isSaved(article.id)"
            :show-feed-title="false"
            :all-tags-with-counts="allTagsWithCounts"
            :selection-mode="selectionMode"
            :is-selected-for-bulk="isSelected(article.id)"
            @toggle-save="toggleSaveArticle(article.id)"
            @toggle-read="handleToggleRead(article.id)"
            @update-tags="handleUpdateTags"
            @toggle-selection="handleToggleSelection(article.id, $event)"
          />
        </div>

        <!-- Empty State -->
        <div v-else class="flex flex-col items-center justify-center py-20 px-4">
          <div class="max-w-md text-center space-y-6">
            <svg class="w-16 h-16 mx-auto text-gray-400 dark:text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h2 class="text-xl font-bold text-gray-900 dark:text-gray-100">All caught up!</h2>
            <p class="text-gray-600 dark:text-gray-400">
              No unread articles in this feed.
            </p>

            <!-- Feed Statistics -->
            <div v-if="selectedFeed" class="bg-gray-50 dark:bg-zinc-900 rounded-lg p-6 space-y-3">
              <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">Feed Statistics</h3>
              <div class="grid grid-cols-2 gap-4 text-sm">
                <div class="text-left">
                  <div class="text-gray-500 dark:text-gray-400">Total Articles</div>
                  <div class="text-2xl font-bold text-gray-900 dark:text-gray-100">{{ articles.length }}</div>
                </div>
                <div class="text-left">
                  <div class="text-gray-500 dark:text-gray-400">Unread</div>
                  <div class="text-2xl font-bold text-blue-600 dark:text-blue-400">{{ selectedFeed.unreadCount || 0 }}</div>
                </div>
                <div class="text-left" v-if="selectedFeed.lastFetchedAt">
                  <div class="text-gray-500 dark:text-gray-400">Last Updated</div>
                  <div class="text-sm font-medium text-gray-700 dark:text-gray-300">{{ formatDate(selectedFeed.lastFetchedAt) }}</div>
                </div>
                <div class="text-left" v-if="selectedFeed.isActive !== undefined">
                  <div class="text-gray-500 dark:text-gray-400">Status</div>
                  <div class="text-sm font-medium" :class="selectedFeed.isActive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'">
                    {{ selectedFeed.isActive ? 'Active' : 'Inactive' }}
                  </div>
                </div>
              </div>
            </div>

            <div class="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                @click="showUnreadOnly = false"
                class="inline-flex items-center gap-2 px-4 py-2 bg-gray-600 hover:bg-gray-700 dark:bg-gray-700 dark:hover:bg-gray-600 text-white rounded-lg transition-colors"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                Show all articles
              </button>
              <NuxtLink
                to="/"
                class="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                View other feeds
              </NuxtLink>
            </div>
          </div>
        </div>

        <!-- Bulk Selection Floating Button -->
        <button v-if="searchedArticles.length > 0 && !selectionMode"
          @click="toggleSelectionMode"
          class="fixed bottom-6 right-6 z-20 p-4 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg transition-colors"
          title="Select multiple articles">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          </svg>
        </button>

        <!-- Bulk Action Bar -->
        <BulkActionBar
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

definePageMeta({
  auth: true
})

const route = useRoute()
const router = useRouter()
const feedId = computed(() => parseInt(route.params.id as string))

const { data: session } = useAuth()

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

const {
  articles,
  selectedArticleId,
  displayedArticles,
  showUnreadOnly,
  loading: articlesLoading,
  fetchArticles,
  markAsRead,
  markAllAsRead
} = useArticles()

const {
  isSaved,
  toggleSave,
  fetchSavedArticleIds
} = useSavedArticles()

const {
  allTagsWithCounts,
  updateSavedArticleTags,
  fetchTags
} = useTags()

const {
  fetchSavedArticlesByTag
} = useSavedArticlesByTag()

// Search functionality
const { searchQuery, filterArticles } = useArticleSearch()

// Bulk selection functionality
const {
  selectionMode,
  selectedArticleIds,
  selectedCount,
  toggleSelectionMode,
  isSelected,
  toggleSelection,
  selectAll,
  clearSelection
} = useBulkSelection()

// Apply search filter to displayed articles
const searchedArticles = computed(() => {
  return filterArticles(displayedArticles.value, searchQuery.value)
})

// Reference to hamburger menu to track its open state
const hamburgerMenuRef = ref<any>(null)
const menuIsOpen = computed(() => hamburgerMenuRef.value?.isOpen ?? false)

// Reference to help dialog
const helpDialogRef = ref<any>(null)

const toggleMenu = () => {
  if (hamburgerMenuRef.value) {
    hamburgerMenuRef.value.isOpen = !hamburgerMenuRef.value.isOpen
  }
}

// Format date helper
const formatDate = (dateString: string) => {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// Toggle save/unsave article
const toggleSaveArticle = async (articleId: number) => {
  try {
    await toggleSave(articleId)
    await fetchSavedArticlesByTag()
  } catch (error) {
    console.error('Failed to toggle save:', error)
  }
}

// Toggle read/unread status
const handleToggleRead = async (articleId: number) => {
  try {
    const article = displayedArticles.value.find(a => a.id === articleId)
    if (article) {
      await markAsRead(articleId, !article.isRead)
    }
  } catch (error) {
    console.error('Failed to toggle read status:', error)
  }
}

// Update tags for a saved article
const handleUpdateTags = async (savedArticleId: number, tags: string[]) => {
  const article = articles.value.find(a => a.savedId === savedArticleId)
  const previousTags = article?.tags || []

  if (article) {
    article.tags = tags
  }

  try {
    await updateSavedArticleTags(savedArticleId, tags)
    await Promise.all([
      fetchTags(),
      fetchSavedArticlesByTag()
    ])
  } catch (error) {
    console.error('Failed to update tags:', error)
    if (article) {
      article.tags = previousTags
    }
  }
}

const handleMarkAsRead = async () => {
  if (selectedArticleId.value !== null) {
    const article = displayedArticles.value.find(a => a.id === selectedArticleId.value)
    if (article && !article.isRead) {
      await markAsRead(selectedArticleId.value, true)
    }
  }
}

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

const handleSyncAll = async () => {
  try {
    await syncAll()
  } catch (error) {
    console.error('Failed to sync all feeds:', error)
  }
}

const handleViewSaved = () => {
  router.push('/saved')
}

const handleSignOut = async () => {
  const { signOut } = useAuth()
  await signOut({ callbackUrl: '/login' })
}

const headerSuccess = ref<string | null>(null)
const headerError = ref<string | null>(null)

const handleHeaderSuccess = (message: string) => {
  headerError.value = null
  headerSuccess.value = message
  setTimeout(() => {
    headerSuccess.value = null
  }, 3000)
}

const handleHeaderError = (message: string) => {
  headerSuccess.value = null
  headerError.value = message
  setTimeout(() => {
    headerError.value = null
  }, 3000)
}

// Bulk selection handlers
const handleToggleSelection = (articleId: number, shiftKey: boolean) => {
  toggleSelection(articleId, searchedArticles.value, shiftKey)
}

const handleBulkMarkRead = async () => {
  try {
    const selectedIds = Array.from(selectedArticleIds.value)
    await Promise.all(selectedIds.map(id => markAsRead(id, true)))
    clearSelection()
    handleHeaderSuccess(`Marked ${selectedIds.length} article${selectedIds.length !== 1 ? 's' : ''} as read`)
  } catch (error) {
    console.error('Failed to mark articles as read:', error)
    handleHeaderError('Failed to mark articles as read')
  }
}

const handleBulkSave = async () => {
  try {
    const selectedIds = Array.from(selectedArticleIds.value)
    await Promise.all(selectedIds.map(id => toggleSave(id)))
    clearSelection()
    await fetchSavedArticlesByTag()
    handleHeaderSuccess(`Saved ${selectedIds.length} article${selectedIds.length !== 1 ? 's' : ''}`)
  } catch (error) {
    console.error('Failed to save articles:', error)
    handleHeaderError('Failed to save articles')
  }
}

const handleBulkClear = () => {
  clearSelection()
}

const handleBulkExit = () => {
  toggleSelectionMode()
}

// Load feeds and articles on mount
onMounted(async () => {
  if (session.value?.user) {
    await Promise.all([
      fetchFeeds(),
      fetchSavedArticleIds(),
      fetchTags(),
      fetchSavedArticlesByTag()
    ])

    // Fetch articles for this feed
    if (feedId.value) {
      await fetchArticles(feedId.value)
    }
  }
})

// Watch for feed ID changes
watch(feedId, async (newFeedId) => {
  if (newFeedId) {
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
