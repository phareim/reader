<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900">
    <!-- Hamburger Menu -->
    <HamburgerMenu ref="hamburgerMenuRef" />

    <!-- Keyboard Shortcuts Help Dialog -->
    <KeyboardShortcutsHelp ref="helpDialogRef" />

    <!-- Main Content Area -->
    <div
      class="min-h-screen transition-all duration-300 ease-in-out"
      :style="{ marginLeft: menuIsOpen ? '20rem' : '0' }"
    >
      <!-- Header -->
      <div class="bg-white dark:bg-gray-800 border-b dark:border-gray-700 px-6 py-4 flex items-center justify-between">
        <div class="flex items-center gap-4">
          <!-- Hamburger Button -->
          <button
            @click="toggleMenu"
            class="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors text-gray-900 dark:text-gray-100"
            aria-label="Toggle menu"
          >
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path v-if="!menuIsOpen" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
              <path v-else stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          <h1 class="text-2xl font-bold flex items-center gap-3 text-gray-900 dark:text-gray-100">
            <template v-if="selectedFeed">
              <img
                v-if="selectedFeed.faviconUrl"
                :src="selectedFeed.faviconUrl"
                :alt="selectedFeed.title"
                class="w-8 h-8"
              />
              <span>{{ selectedFeed.title }}</span>
            </template>
            <span v-else>All Vibes — The RSS Reader</span>
          </h1>
        </div>
        <div class="flex gap-4 items-center">
          <label class="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
            <input v-model="showUnreadOnly" type="checkbox" class="rounded" />
            Unread only
          </label>
          <button
            v-if="displayedArticles.length > 0"
            @click="handleMarkAllRead"
            class="px-3 py-1 text-sm bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
          >
            Mark all read
          </button>
        </div>
      </div>

      <!-- Articles List (Full Width) -->
      <div class="max-w-5xl mx-auto py-4">
        <div v-if="articlesLoading" class="text-center text-gray-500 dark:text-gray-400 py-8">Loading...</div>
        <div v-else-if="displayedArticles.length === 0" class="text-center text-gray-500 dark:text-gray-400 py-8">
          No articles to display. Open the menu to add feeds!
        </div>
        <div v-else class="space-y-0">
          <div
            v-for="article in displayedArticles"
            :key="article.id"
            class="border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-750 cursor-pointer transition-colors"
            :class="{
              'ring-2 ring-blue-400 dark:ring-blue-500 ring-inset': selectedArticleId === article.id && expandedArticleId !== article.id,
              'ring-2 ring-blue-500 dark:ring-blue-400 ring-inset bg-blue-50 dark:bg-blue-900/20': expandedArticleId === article.id
            }"
            @click="handleOpenArticle(article.id)"
          >
            <!-- Article Header -->
            <div class="px-6 py-4">
              <div class="flex items-start justify-between gap-4">
                <div class="flex-1 min-w-0">
                  <h2
                    class="text-lg mb-1"
                    :class="article.isRead ? 'font-normal text-gray-700 dark:text-gray-400' : 'font-bold text-gray-900 dark:text-gray-100'"
                  >
                    {{ article.title }}
                  </h2>
                  <div class="text-sm text-gray-500 dark:text-gray-400">
                    <span v-if="!selectedFeed">{{ article.feedTitle }} • </span>
                    {{ formatDate(article.publishedAt) }}
                    <span v-if="article.author"> • {{ article.author }}</span>
                  </div>
                </div>
                <div class="flex items-center gap-2">
                  <span v-if="!article.isRead" class="text-blue-500 dark:text-blue-400 text-2xl leading-none">•</span>
                  <a
                    :href="article.url"
                    target="_blank"
                    class="text-blue-500 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 text-sm"
                    @click.stop
                  >
                    Open →
                  </a>
                </div>
              </div>
            </div>

            <!-- Article Content (Expanded Inline) -->
            <Transition name="expand">
              <div v-if="expandedArticleId === article.id" class="px-6 pb-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
                <div
                  v-if="article.content"
                  class="prose prose-sm dark:prose-invert max-w-none mt-4"
                  v-html="article.content"
                ></div>
                <div v-else-if="article.summary" class="text-gray-700 dark:text-gray-300 mt-4">
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
  fetchFeeds,
  refreshFeed,
  syncAll
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

// Separate state for expanded article (different from selected/highlighted)
const expandedArticleId = ref<number | null>(null)

// Reference to hamburger menu to track its open state
const hamburgerMenuRef = ref<any>(null)
const menuIsOpen = computed(() => hamburgerMenuRef.value?.isOpen ?? false)

// Reference to help dialog
const helpDialogRef = ref<any>(null)

// Track last key for g-combinations
const lastKey = ref<string | null>(null)
const lastKeyTimeout = ref<any>(null)

const toggleMenu = () => {
  if (hamburgerMenuRef.value) {
    hamburgerMenuRef.value.isOpen = !hamburgerMenuRef.value.isOpen
  }
}

// Load feeds on mount
onMounted(async () => {
  await fetchFeeds()

  // Keyboard shortcuts handler
  const handleKeydown = async (e: KeyboardEvent) => {
    // Ignore if typing in an input field
    const target = e.target as HTMLElement
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
      return
    }

    // Ignore if help dialog is open (except for Escape)
    if (helpDialogRef.value?.isOpen && e.key !== 'Escape') {
      return
    }

    const key = e.key
    const shiftKey = e.shiftKey

    // Track key for g-combinations
    if (key === 'g') {
      lastKey.value = 'g'
      clearTimeout(lastKeyTimeout.value)
      lastKeyTimeout.value = setTimeout(() => {
        lastKey.value = null
      }, 1000)
      return
    }

    // Handle g-combinations
    if (lastKey.value === 'g') {
      lastKey.value = null
      clearTimeout(lastKeyTimeout.value)

      if (key === 'i' || key === 'a') {
        // g+i or g+a: Go to all feeds
        selectedFeedId.value = null
        return
      }
      return
    }

    // Navigation: j/k or arrow keys
    if (key === 'j' || key === 'ArrowDown') {
      e.preventDefault()
      navigateArticles('down')
      return
    }
    if (key === 'k' || key === 'ArrowUp') {
      e.preventDefault()
      navigateArticles('up')
      return
    }

    // Open/close article: o, Enter
    if (key === 'o' || key === 'Enter') {
      e.preventDefault()
      if (selectedArticleId.value === null && displayedArticles.value.length > 0) {
        // Select and open first article if none selected
        selectedArticleId.value = displayedArticles.value[0].id
        await handleOpenArticle(displayedArticles.value[0].id)
      } else if (selectedArticleId.value !== null) {
        // Open selected article
        await handleOpenArticle(selectedArticleId.value)
      }
      return
    }

    // Close expanded article: Escape
    if (key === 'Escape') {
      e.preventDefault()
      if (expandedArticleId.value !== null) {
        expandedArticleId.value = null
      }
      return
    }

    // Mark as read without opening: e
    if (key === 'e' && !shiftKey) {
      e.preventDefault()
      await handleMarkAsRead()
      return
    }

    // Toggle menu: m
    if (key === 'm' && !shiftKey) {
      e.preventDefault()
      toggleMenu()
      return
    }

    // Mark as unread: Shift+U
    if (key === 'U' && shiftKey) {
      e.preventDefault()
      if (selectedArticleId.value !== null) {
        const article = displayedArticles.value.find(a => a.id === selectedArticleId.value)
        if (article && article.isRead) {
          await markAsRead(selectedArticleId.value, false)
        }
      }
      return
    }

    // View original: v
    if (key === 'v') {
      e.preventDefault()
      if (selectedArticleId.value !== null) {
        const article = displayedArticles.value.find(a => a.id === selectedArticleId.value)
        if (article) {
          window.open(article.url, '_blank')
        }
      }
      return
    }

    // Mark all as read: Shift+E
    if (key === 'E' && shiftKey) {
      e.preventDefault()
      await handleMarkAllRead()
      return
    }

    // Refresh current feed: r
    if (key === 'r' && !shiftKey) {
      e.preventDefault()
      if (selectedFeedId.value !== null) {
        try {
          await refreshFeed(selectedFeedId.value)
        } catch (error) {
          console.error('Failed to refresh feed:', error)
        }
      }
      return
    }

    // Refresh all feeds: Shift+R
    if (key === 'R' && shiftKey) {
      e.preventDefault()
      try {
        await syncAll()
      } catch (error) {
        console.error('Failed to sync all feeds:', error)
      }
      return
    }

    // Show help: ?
    if (key === '?' || (key === '/' && shiftKey)) {
      e.preventDefault()
      helpDialogRef.value?.open()
      return
    }
  }

  window.addEventListener('keydown', handleKeydown)

  onUnmounted(() => {
    window.removeEventListener('keydown', handleKeydown)
    clearTimeout(lastKeyTimeout.value)
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

// Clear expanded article if it's no longer in the displayed list
watch(displayedArticles, () => {
  if (expandedArticleId.value !== null) {
    const stillExists = displayedArticles.value.some(a => a.id === expandedArticleId.value)
    if (!stillExists) {
      expandedArticleId.value = null
    }
  }
  if (selectedArticleId.value !== null) {
    const stillExists = displayedArticles.value.some(a => a.id === selectedArticleId.value)
    if (!stillExists) {
      selectedArticleId.value = null
    }
  }
})

// Navigate articles (highlight without opening)
const navigateArticles = (direction: 'up' | 'down') => {
  const currentIndex = displayedArticles.value.findIndex(a => a.id === selectedArticleId.value)

  if (direction === 'up' && currentIndex > 0) {
    selectedArticleId.value = displayedArticles.value[currentIndex - 1].id
  } else if (direction === 'down' && currentIndex < displayedArticles.value.length - 1) {
    selectedArticleId.value = displayedArticles.value[currentIndex + 1].id
  } else if (direction === 'down' && currentIndex === -1 && displayedArticles.value.length > 0) {
    // If nothing selected, select first article
    selectedArticleId.value = displayedArticles.value[0].id
  }
}

// Open/expand article and mark as read
const handleOpenArticle = async (id: number) => {
  // Toggle if clicking the same expanded article
  if (expandedArticleId.value === id) {
    expandedArticleId.value = null
  } else {
    expandedArticleId.value = id
    selectedArticleId.value = id
    const article = displayedArticles.value.find(a => a.id === id)
    if (article && !article.isRead) {
      await markAsRead(id, true)
    }
  }
}

// Mark selected article as read without opening
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
