<template>
  <div class="min-h-screen bg-gray-50">
    <!-- Hamburger Menu -->
    <HamburgerMenu ref="hamburgerMenuRef" />

    <!-- Main Content Area -->
    <div
      class="min-h-screen transition-all duration-300 ease-in-out"
      :style="{ marginLeft: menuIsOpen ? '20rem' : '0' }"
    >
      <!-- Header -->
      <div class="bg-white border-b px-6 py-4 flex items-center justify-between">
        <div class="flex items-center gap-4">
          <!-- Hamburger Button -->
          <button
            @click="toggleMenu"
            class="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Toggle menu"
          >
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path v-if="!menuIsOpen" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
              <path v-else stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          <h1 class="text-2xl font-bold">
            <span v-if="selectedFeed">{{ selectedFeed.title }}</span>
            <span v-else>All Vibes — The RSS Reader</span>
          </h1>
        </div>
        <div class="flex gap-4 items-center">
          <label class="flex items-center gap-2 text-sm">
            <input v-model="showUnreadOnly" type="checkbox" class="rounded" />
            Unread only
          </label>
          <button
            v-if="displayedArticles.length > 0"
            @click="handleMarkAllRead"
            class="px-3 py-1 text-sm bg-gray-200 rounded hover:bg-gray-300"
          >
            Mark all read
          </button>
        </div>
      </div>

      <!-- Articles List (Full Width) -->
      <div class="max-w-5xl mx-auto py-4">
        <div v-if="articlesLoading" class="text-center text-gray-500 py-8">Loading...</div>
        <div v-else-if="displayedArticles.length === 0" class="text-center text-gray-500 py-8">
          No articles to display. Open the menu to add feeds!
        </div>
        <div v-else class="space-y-0">
          <div
            v-for="article in displayedArticles"
            :key="article.id"
            class="border-b bg-white hover:bg-gray-50 cursor-pointer transition-colors"
            @click="handleSelectArticle(article.id)"
          >
            <!-- Article Header -->
            <div class="px-6 py-4">
              <div class="flex items-start justify-between gap-4">
                <div class="flex-1 min-w-0">
                  <h2
                    class="text-lg mb-1"
                    :class="article.isRead ? 'font-normal text-gray-700' : 'font-bold text-gray-900'"
                  >
                    {{ article.title }}
                  </h2>
                  <div class="text-sm text-gray-500">
                    <span v-if="!selectedFeed">{{ article.feedTitle }} • </span>
                    {{ formatDate(article.publishedAt) }}
                    <span v-if="article.author"> • {{ article.author }}</span>
                  </div>
                </div>
                <div class="flex items-center gap-2">
                  <span v-if="!article.isRead" class="text-blue-500 text-2xl leading-none">•</span>
                  <a
                    :href="article.url"
                    target="_blank"
                    class="text-blue-500 hover:text-blue-700 text-sm"
                    @click.stop
                  >
                    Open →
                  </a>
                </div>
              </div>
            </div>

            <!-- Article Content (Expanded Inline) -->
            <Transition name="expand">
              <div v-if="selectedArticleId === article.id" class="px-6 pb-6 border-t bg-gray-50">
                <div
                  v-if="article.content"
                  class="prose prose-sm max-w-none mt-4"
                  v-html="article.content"
                ></div>
                <div v-else-if="article.summary" class="text-gray-700 mt-4">
                  {{ article.summary }}
                </div>
              </div>
            </Transition>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { formatDistanceToNow } from 'date-fns'

definePageMeta({
  auth: true
})

const {
  feeds,
  selectedFeedId,
  selectedFeed,
  loading: feedsLoading,
  fetchFeeds
} = useFeeds()

const {
  selectedArticleId,
  selectedArticle,
  showUnreadOnly,
  displayedArticles,
  loading: articlesLoading,
  fetchArticles,
  markAsRead,
  markAllAsRead
} = useArticles()

// Reference to hamburger menu to track its open state
const hamburgerMenuRef = ref<any>(null)
const menuIsOpen = computed(() => hamburgerMenuRef.value?.isOpen ?? false)

const toggleMenu = () => {
  if (hamburgerMenuRef.value) {
    hamburgerMenuRef.value.isOpen = !hamburgerMenuRef.value.isOpen
  }
}

// Load feeds on mount
onMounted(async () => {
  await fetchFeeds()

  // Keyboard navigation
  const handleKeydown = (e: KeyboardEvent) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      navigateArticles('up')
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      navigateArticles('down')
    }
  }
  window.addEventListener('keydown', handleKeydown)

  onUnmounted(() => {
    window.removeEventListener('keydown', handleKeydown)
  })
})

// Watch for feed selection changes
watch(selectedFeedId, async (feedId) => {
  if (feedId !== null) {
    await fetchArticles(feedId)
  } else {
    await fetchArticles()
  }
})

// Watch for unread filter changes
watch(showUnreadOnly, async () => {
  if (selectedFeedId.value !== null) {
    await fetchArticles(selectedFeedId.value)
  } else {
    await fetchArticles()
  }
})

const handleSelectArticle = async (id: number, toggle = true) => {
  // Toggle selection if clicking the same article (when toggle is true)
  if (toggle && selectedArticleId.value === id) {
    selectedArticleId.value = null
  } else {
    selectedArticleId.value = id
    const article = displayedArticles.value.find(a => a.id === id)
    if (article && !article.isRead) {
      await markAsRead(id, true)
    }
  }
}

const navigateArticles = (direction: 'up' | 'down') => {
  const currentIndex = displayedArticles.value.findIndex(a => a.id === selectedArticleId.value)

  if (direction === 'up' && currentIndex > 0) {
    const newArticle = displayedArticles.value[currentIndex - 1]
    handleSelectArticle(newArticle.id, false) // Don't toggle, just select
  } else if (direction === 'down' && currentIndex < displayedArticles.value.length - 1) {
    const newArticle = displayedArticles.value[currentIndex + 1]
    handleSelectArticle(newArticle.id, false) // Don't toggle, just select
  } else if (direction === 'down' && currentIndex === -1 && displayedArticles.value.length > 0) {
    // If nothing selected, select first article
    const firstArticle = displayedArticles.value[0]
    handleSelectArticle(firstArticle.id, false)
  }
}

const handleMarkAllRead = async () => {
  try {
    await markAllAsRead(selectedFeedId.value ?? undefined)
  } catch (error) {
    console.error('Failed to mark all as read:', error)
  }
}

const formatDate = (dateStr: string | null | undefined) => {
  if (!dateStr) return 'Unknown date'
  try {
    return formatDistanceToNow(new Date(dateStr), { addSuffix: true })
  } catch {
    return 'Unknown date'
  }
}
</script>

<style scoped>
/* Expand transition for article content */
.expand-enter-active,
.expand-leave-active {
  transition: all 0.3s ease;
  overflow: hidden;
}

.expand-enter-from,
.expand-leave-to {
  max-height: 0;
  opacity: 0;
}

.expand-enter-to,
.expand-leave-from {
  max-height: 10000px;
  opacity: 1;
}
</style>
