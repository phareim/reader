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
        :selected-feed-id="-1"
        :selected-tag="null"
        @toggle-menu="toggleMenu"
        @mark-all-read="() => {}"
        @refresh-feed="() => {}"
        @sync-all="handleSyncAll"
        @view-saved="() => {}"
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
        <div v-else-if="articles.length > 0" class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 p-4">
          <LazyArticleCard
            v-for="article in articles"
            :key="article.id"
            :article="article"
            :is-selected="selectedArticleId === article.id"
            :is-saved="true"
            :show-feed-title="true"
            :all-tags-with-counts="allTagsWithCounts"
            @toggle-save="toggleSaveArticle(article.id)"
            @toggle-read="handleToggleRead(article.id)"
            @update-tags="handleUpdateTags"
            @delete-article="handleDeleteArticle(article.id)"
          />
        </div>

        <!-- Empty State -->
        <div v-else class="flex flex-col items-center justify-center py-20 px-4">
          <div class="max-w-md text-center space-y-4">
            <svg class="w-20 h-20 mx-auto text-yellow-500 dark:text-yellow-400" fill="currentColor" viewBox="0 0 24 24">
              <path d="M17 3H7c-1.1 0-2 .9-2 2v16l7-3 7 3V5c0-1.1-.9-2-2-2z"/>
            </svg>
            <h2 class="text-xl font-bold text-gray-900 dark:text-gray-100">No Saved Articles</h2>
            <p class="text-gray-600 dark:text-gray-400">
              Articles you save will appear here.
            </p>
            <NuxtLink
              to="/"
              class="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              Browse articles
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

const router = useRouter()
const { data: session } = useAuth()

const {
  feeds,
  fetchFeeds,
  syncAll
} = useFeeds()

const {
  articles,
  selectedArticleId,
  loading: articlesLoading,
  fetchArticles,
  markAsRead
} = useArticles()

const {
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

// Toggle save/unsave article
const toggleSaveArticle = async (articleId: number) => {
  try {
    await toggleSave(articleId)
    await fetchSavedArticlesByTag()
    await fetchArticles(-1) // Refresh saved articles
  } catch (error) {
    console.error('Failed to toggle save:', error)
  }
}

// Toggle read/unread status
const handleToggleRead = async (articleId: number) => {
  try {
    const article = articles.value.find(a => a.id === articleId)
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

// Delete an article (only for manually added articles)
const handleDeleteArticle = async (articleId: number) => {
  try {
    await $fetch(`/api/articles/${articleId}/delete`, {
      method: 'DELETE'
    })

    // Refresh the articles list
    await fetchArticles(-1)
    await fetchSavedArticlesByTag()
    await fetchFeeds()

    headerSuccess.value = 'Article deleted successfully'
    setTimeout(() => {
      headerSuccess.value = null
    }, 3000)
  } catch (error: any) {
    console.error('Failed to delete article:', error)
    headerError.value = error.data?.message || error.message || 'Failed to delete article'
    setTimeout(() => {
      headerError.value = null
    }, 5000)
  }
}

const handleMarkAsRead = async () => {
  if (selectedArticleId.value !== null) {
    const article = articles.value.find(a => a.id === selectedArticleId.value)
    if (article && !article.isRead) {
      await markAsRead(selectedArticleId.value, true)
    }
  }
}

const handleSyncAll = async () => {
  try {
    await syncAll()
  } catch (error) {
    console.error('Failed to sync all feeds:', error)
  }
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

// Load feeds and saved articles on mount
onMounted(async () => {
  if (session.value?.user) {
    await Promise.all([
      fetchFeeds(),
      fetchSavedArticleIds(),
      fetchTags(),
      fetchSavedArticlesByTag()
    ])

    // Fetch saved articles
    await fetchArticles(-1)
  }
})

// Register global keyboard shortcuts
useKeyboardShortcuts({
  helpDialogRef,
  toggleMenu,
  selectedArticleId,
  displayedArticles: computed(() => articles.value),
  selectedFeedId: computed(() => -1),
  showUnreadOnly: computed(() => false),
  markAsRead,
  refreshFeed: async () => {},
  syncAll,
  toggleSaveArticle,
  handleMarkAsRead,
  handleMarkAllRead: async () => {}
})
</script>
