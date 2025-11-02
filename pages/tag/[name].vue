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
        :selected-feed="null"
        :selected-feed-id="null"
        :selected-tag="tagName"
        :unread-count="unreadArticles.length"
        @toggle-menu="toggleMenu"
        @mark-all-read="markAllReadHandler"
        @refresh-feed="handleRefreshTag"
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

        <!-- Article Grid Grouped by Feed -->
        <div v-else-if="displayedArticles.length > 0" class="p-4 space-y-8">
          <div v-for="group in articlesByFeed" :key="group.feed.id" class="space-y-3">
            <!-- Feed Header -->
            <div class="flex items-center gap-2 pb-2 border-b border-gray-200 dark:border-zinc-800">
              <img
                v-if="group.feed.faviconUrl"
                :src="group.feed.faviconUrl"
                :alt="group.feed.title"
                class="w-5 h-5 flex-shrink-0"
              />
              <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {{ group.feed.title }}
              </h2>
              <span class="text-sm text-gray-500 dark:text-gray-400">
                ({{ group.articles.length }} article{{ group.articles.length !== 1 ? 's' : '' }})
              </span>
            </div>

            <!-- Articles for this feed -->
            <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              <LazyArticleCard
                v-for="article in group.articles"
                :key="article.id"
                :article="article"
                :is-selected="selectedArticleId === article.id"
                :is-saved="isSaved(article.id)"
                :show-feed-title="false"
                :all-tags-with-counts="allTagsWithCounts"
                @toggle-save="toggleSaveArticle(article.id)"
                @toggle-read="handleToggleRead(article.id)"
                @update-tags="handleUpdateTags"
              />
            </div>
          </div>
        </div>

        <!-- Empty State -->
        <div v-else class="flex flex-col items-center justify-center py-20 px-4">
          <div class="max-w-md text-center space-y-4">
            <svg class="w-16 h-16 mx-auto text-gray-400 dark:text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
            </svg>
            <h2 class="text-xl font-bold text-gray-900 dark:text-gray-100">No articles in #{{ tagName }}</h2>
            <p class="text-gray-600 dark:text-gray-400">
              There are no articles tagged with "{{ tagName }}".
            </p>
            <NuxtLink
              to="/"
              class="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              View all articles
            </NuxtLink>
          </div>
        </div>
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
const tagName = computed(() => route.params.name as string)

const { data: session } = useAuth()

const {
  feeds,
  selectedTag,
  selectedTagFeedIds,
  fetchFeeds,
  syncAll,
  refreshFeed
} = useFeeds()

const {
  articles,
  selectedArticleId,
  displayedArticles,
  unreadArticles,
  loading: articlesLoading,
  fetchArticles,
  markAsRead,
  markAllAsRead
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

// Use shared article handlers
const {
  toggleSaveArticle,
  handleToggleRead,
  handleUpdateTags,
  handleMarkAsRead,
  handleMarkAllRead: markAllReadHandler
} = useArticleViewHandlers()

// Reference to hamburger menu to track its open state
const hamburgerMenuRef = ref<any>(null)
const menuIsOpen = computed(() => hamburgerMenuRef.value?.isOpen ?? false)

// Reference to help dialog
const helpDialogRef = ref<any>(null)

// Group articles by feed for better organization
const articlesByFeed = computed(() => {
  const grouped = new Map<number, { feed: { id: number; title: string; faviconUrl?: string }; articles: typeof displayedArticles.value }>()

  displayedArticles.value.forEach(article => {
    if (!grouped.has(article.feedId)) {
      grouped.set(article.feedId, {
        feed: {
          id: article.feedId,
          title: article.feedTitle || 'Unknown Feed',
          faviconUrl: article.feedFavicon || undefined
        },
        articles: []
      })
    }
    grouped.get(article.feedId)!.articles.push(article)
  })

  // Convert to array and sort by feed title
  return Array.from(grouped.values()).sort((a, b) =>
    a.feed.title.localeCompare(b.feed.title)
  )
})

const toggleMenu = () => {
  if (hamburgerMenuRef.value) {
    hamburgerMenuRef.value.isOpen = !hamburgerMenuRef.value.isOpen
  }
}

const handleRefreshTag = async () => {
  try {
    // Refresh all feeds in this tag
    const feedIds = selectedTagFeedIds.value
    if (feedIds.length === 0) return

    handleHeaderSuccess(`Refreshing ${feedIds.length} feed${feedIds.length > 1 ? 's' : ''}...`)

    await Promise.all(feedIds.map(id => refreshFeed(id)))

    // Refresh the articles list
    await fetchArticles(undefined, selectedTagFeedIds.value)

    handleHeaderSuccess('Tag refreshed successfully!')
  } catch (error) {
    console.error('Failed to refresh tag:', error)
    handleHeaderError('Failed to refresh tag')
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

// Load feeds and articles on mount
onMounted(async () => {
  if (session.value?.user) {
    await Promise.all([
      fetchFeeds(),
      fetchSavedArticleIds(),
      fetchTags(),
      fetchSavedArticlesByTag()
    ])

    // Set the selected tag to match the route
    selectedTag.value = tagName.value

    // Fetch articles for this tag
    await fetchArticles(undefined, selectedTagFeedIds.value)
  }
})

// Watch for tag name changes
watch(tagName, async (newTagName) => {
  if (newTagName) {
    // Update the selected tag
    selectedTag.value = newTagName

    // Fetch articles for the new tag
    await fetchArticles(undefined, selectedTagFeedIds.value)
  }
})

// Register global keyboard shortcuts
useKeyboardShortcuts({
  helpDialogRef,
  toggleMenu,
  selectedArticleId,
  displayedArticles,
  selectedFeedId: computed(() => null),
  showUnreadOnly: computed(() => false),
  markAsRead,
  refreshFeed: async () => {},
  syncAll,
  toggleSaveArticle,
  handleMarkAsRead,
  handleMarkAllRead: markAllReadHandler
})
</script>
