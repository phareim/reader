<template>
  <div class="min-h-screen bg-gray-50 dark:bg-zinc-950">
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
        @toggle-menu="toggleMenu"
        @mark-all-read="handleMarkAllRead"
        @refresh-feed="() => {}"
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
        <div v-else-if="displayedArticles.length > 0" class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 p-4">
          <LazyArticleCard
            v-for="article in displayedArticles"
            :key="article.id"
            :article="article"
            :is-selected="selectedArticleId === article.id"
            :is-saved="isSaved(article.id)"
            :show-feed-title="true"
            :all-tags-with-counts="allTagsWithCounts"
            @toggle-save="toggleSaveArticle(article.id)"
            @toggle-read="handleToggleRead(article.id)"
            @update-tags="handleUpdateTags"
          />
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
  syncAll
} = useFeeds()

const {
  articles,
  selectedArticleId,
  displayedArticles,
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
    const articlesToMark = displayedArticles.value.filter(a => !a.isRead)
    articlesToMark.forEach(article => {
      article.isRead = true
      article.readAt = new Date().toISOString()
    })
    Promise.all(articlesToMark.map(article =>
      markAsRead(article.id, true).catch(err => {
        article.isRead = false
        article.readAt = null
        console.error('Failed to mark article as read:', err)
      })
    ))
  } catch (error) {
    console.error('Failed to mark all as read:', error)
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
  handleMarkAllRead
})
</script>
