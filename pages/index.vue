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
      <div class="bg-white h-16 dark:bg-gray-800 border-b dark:border-gray-700 px-6 py-4 flex items-center justify-between">
        <div class="flex items-center gap-4">
          <!-- Hamburger Button -->
          <button
            @click="toggleMenu"
            class="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors text-gray-900 dark:text-gray-100"
            aria-label="Toggle menu"
          >
            <svg v-if="!menuIsOpen" class="w-6 h-6" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path fill="currentColor" fill-rule="evenodd" d="M4.167 3C3.522 3 3 3.522 3 4.167v11.666C3 16.478 3.522 17 4.167 17H7V3zM8 3v14h7.833c.645 0 1.167-.522 1.167-1.167V4.167C17 3.522 16.478 3 15.833 3zM2 4.167C2 2.97 2.97 2 4.167 2h11.666C17.03 2 18 2.97 18 4.167v11.666C18 17.03 17.03 18 15.833 18H4.167A2.167 2.167 0 0 1 2 15.833z" clip-rule="evenodd" />
            </svg>
            <svg v-else class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          <h1 class="text-xl font-bold flex items-center gap-3 text-gray-900 dark:text-gray-100">
            <template v-if="selectedFeedId === -1">
              <svg class="w-7 h-7 text-yellow-500 dark:text-yellow-400" fill="currentColor" viewBox="0 0 24 24">
                <path d="M17 3H7c-1.1 0-2 .9-2 2v16l7-3 7 3V5c0-1.1-.9-2-2-2z"/>
              </svg>
              <span>Saved Articles</span>
            </template>
            <template v-else-if="selectedFeed">
              <img
                v-if="selectedFeed.faviconUrl"
                :src="selectedFeed.faviconUrl"
                :alt="selectedFeed.title"
                class="w-8 h-8"
              />
              <span>{{ selectedFeed.title }}</span>
            </template>
            <template v-else-if="selectedTag">
              <span v-if="selectedTag === '__inbox__'">📥 Inbox</span>
              <span v-else>#{{ selectedTag }}</span>
            </template>
            <span v-else>All Vibes — The RSS Reader</span>
          </h1>
        </div>
      </div>

      <!-- Articles List (Full Width) -->
      <div class="max-w-5xl mx-auto py-4">
        <div v-if="articlesLoading" class="text-center text-gray-500 dark:text-gray-400 py-8">Loading...</div>
        <div v-else-if="displayedArticles.length === 0" class="px-6 py-8">
          <div v-if="feeds.length === 0" class="text-center text-gray-500 dark:text-gray-400">
            No feeds yet. Open the menu to add feeds!
          </div>
          <div v-else class="max-w-2xl mx-auto">
            <h2 class="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6 text-center">
              All caught up! 🎉
            </h2>
            <p class="text-center text-gray-600 dark:text-gray-400 mb-8">
              You've read everything in this view. Here's what's waiting for you:
            </p>

            <div class="space-y-3">
              <!-- Tags with unread articles -->
              <div
                v-for="tag in allTags"
                :key="tag"
                v-show="getTagUnreadCount(tag) > 0"
              >
                <button
                  @click="handleSelectTag(tag)"
                  class="w-full flex items-center justify-between px-6 py-4 bg-white dark:bg-gray-800 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-lg border border-gray-200 dark:border-gray-700 transition-colors text-left"
                >
                  <div class="flex items-center gap-3">
                    <span class="text-2xl">#</span>
                    <span class="text-lg font-medium text-gray-900 dark:text-gray-100">{{ tag }}</span>
                  </div>
                  <div class="flex items-center gap-2">
                    <span class="text-sm text-gray-500 dark:text-gray-400">{{ getTagUnreadCount(tag) }} unread</span>
                    <svg class="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </button>
              </div>

              <!-- Inbox with unread articles -->
              <div v-if="feedsByTag['__inbox__'] && getInboxUnreadCount() > 0">
                <button
                  @click="handleSelectTag('__inbox__')"
                  class="w-full flex items-center justify-between px-6 py-4 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-700 transition-colors text-left"
                >
                  <div class="flex items-center gap-3">
                    <span class="text-2xl">📥</span>
                    <span class="text-lg font-medium text-gray-900 dark:text-gray-100">Inbox</span>
                  </div>
                  <div class="flex items-center gap-2">
                    <span class="text-sm text-gray-500 dark:text-gray-400">{{ getInboxUnreadCount() }} unread</span>
                    <svg class="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </button>
              </div>

              <!-- If no unread at all -->
              <div v-if="totalUnreadCount === 0" class="text-center py-8">
                <p class="text-gray-500 dark:text-gray-400 mb-4">
                  No unread articles anywhere!
                </p>
                <button
                  @click="handleSyncAll"
                  class="px-6 py-3 bg-blue-500 dark:bg-blue-600 text-white rounded-lg hover:bg-blue-600 dark:hover:bg-blue-700 transition-colors inline-flex items-center gap-2"
                >
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  <span>Refresh All Feeds</span>
                </button>
              </div>
            </div>
          </div>
        </div>
        <div v-else class="space-y-0">
          <div
            v-for="article in displayedArticles"
            :key="article.id"
            class="border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-750 cursor-pointer transition-colors"
            :class="{
              'ring-2 ring-blue-400 dark:ring-blue-500 ring-inset': selectedArticleId === article.id && expandedArticleId !== article.id,
              'ring-2 ring-blue-500 dark:ring-blue-600 ring-inset bg-blue-50 dark:bg-gray-800/70': expandedArticleId === article.id
            }"
            @click="handleOpenArticle(article.id)"
          >
            <!-- Article Header -->
            <div class="px-6 py-4">
              <div class="flex items-start justify-between gap-4">
                <div class="flex-1 min-w-0">
                  <h2
                    class="text-lg mb-1"
                    :class="article.isRead ? 'font-normal text-gray-700 dark:text-gray-300' : 'font-bold text-gray-900 dark:text-gray-100'"
                  >
                    {{ article.title }}
                  </h2>
                  <div class="text-sm text-gray-500 dark:text-gray-400">
                    <span v-if="!selectedFeed">{{ article.feedTitle }} • </span>
                    {{ formatDate(article.publishedAt) }}
                    <span v-if="article.author"> • {{ article.author }}</span>
                  </div>
                </div>
                <div class="flex items-center gap-3">
                  <span v-if="!article.isRead" class="text-blue-500 dark:text-blue-400 text-2xl leading-none">•</span>

                  <!-- Bookmark/Save Button -->
                  <button
                    @click.stop="toggleSaveArticle(article.id)"
                    class="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                    :class="isSaved(article.id) ? 'text-yellow-500 dark:text-yellow-400' : 'text-gray-400 dark:text-gray-500'"
                    :title="isSaved(article.id) ? 'Unsave article' : 'Save article'"
                  >
                    <svg v-if="isSaved(article.id)" class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M17 3H7c-1.1 0-2 .9-2 2v16l7-3 7 3V5c0-1.1-.9-2-2-2z"/>
                    </svg>
                    <svg v-else class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"/>
                    </svg>
                  </button>

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
              <div v-if="expandedArticleId === article.id" class="px-6 pb-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/60">
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
  selectedTag,
  selectedFeed,
  selectedTagFeedIds,
  allTags,
  feedsByTag,
  totalUnreadCount,
  loading: feedsLoading,
  fetchFeeds,
  refreshFeed,
  syncAll
} = useFeeds()

const {
  articles,
  selectedArticleId,
  selectedArticle,
  showUnreadOnly,
  displayedArticles: _displayedArticles,
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

// Override displayedArticles to ignore unread filter when viewing saved articles
const displayedArticles = computed(() => {
  // When viewing saved articles (feedId === -1), show all saved articles
  if (selectedFeedId.value === -1) {
    return articles.value
  }
  // Otherwise use the default filtering from useArticles
  return _displayedArticles.value
})

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

// Toggle save/unsave article
const toggleSaveArticle = async (articleId: number) => {
  try {
    await toggleSave(articleId)
  } catch (error) {
    console.error('Failed to toggle save:', error)
  }
}

// Load feeds and saved articles on mount
onMounted(async () => {
  await Promise.all([
    fetchFeeds(),
    fetchSavedArticleIds()
  ])

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
        await handleOpenArticle(displayedArticles.value[0].id, false)
      } else if (selectedArticleId.value !== null) {
        // Toggle the currently selected article
        await handleOpenArticle(selectedArticleId.value, true)
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

    // Save/unsave article: s
    if (key === 's' && !shiftKey) {
      e.preventDefault()
      if (selectedArticleId.value !== null) {
        await toggleSaveArticle(selectedArticleId.value)
      }
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

// Watch for feed or tag selection changes
watch([selectedFeedId, selectedTag], async ([feedId, tag]) => {
  if (feedId !== null) {
    // Specific feed selected - fetch articles from that feed
    await fetchArticles(feedId)
  } else if (tag !== null) {
    // Tag selected but no specific feed - fetch articles from all feeds with this tag
    await fetchArticles(undefined, selectedTagFeedIds.value)
  } else {
    // No feed or tag selected - fetch all articles
    await fetchArticles()
  }
})

// Watch for unread filter changes
watch(showUnreadOnly, async () => {
  if (selectedFeedId.value !== null) {
    await fetchArticles(selectedFeedId.value)
  } else if (selectedTag.value !== null) {
    await fetchArticles(undefined, selectedTagFeedIds.value)
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

// Navigate articles (auto-open)
const navigateArticles = async (direction: 'up' | 'down') => {
  const currentIndex = displayedArticles.value.findIndex(a => a.id === selectedArticleId.value)
  let newArticleId: number | null = null

  if (direction === 'up' && currentIndex > 0) {
    newArticleId = displayedArticles.value[currentIndex - 1].id
  } else if (direction === 'down' && currentIndex < displayedArticles.value.length - 1) {
    newArticleId = displayedArticles.value[currentIndex + 1].id
  } else if (direction === 'down' && currentIndex === displayedArticles.value.length - 1) {
    // At the last article and pressing down - mark all as read
    await handleMarkAllRead()
    return
  } else if (direction === 'down' && currentIndex === -1 && displayedArticles.value.length > 0) {
    // If nothing selected, select first article
    newArticleId = displayedArticles.value[0].id
  }

  if (newArticleId !== null) {
    selectedArticleId.value = newArticleId
    await handleOpenArticle(newArticleId, false) // Don't toggle, always open
  }
}

// Open/expand article and mark as read
const handleOpenArticle = async (id: number, toggle = true) => {
  // Toggle if clicking the same expanded article (only when toggle is true)
  if (toggle && expandedArticleId.value === id) {
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
    if (selectedFeedId.value !== null) {
      // Mark all in specific feed
      await markAllAsRead(selectedFeedId.value)
    } else if (selectedTag.value !== null) {
      // Mark all in tag - need to mark all articles from feeds with this tag
      // We can do this by marking all displayed articles as read
      for (const article of displayedArticles.value) {
        if (!article.isRead) {
          await markAsRead(article.id, true)
        }
      }
    } else {
      // Mark all articles
      await markAllAsRead()
    }
  } catch (error) {
    console.error('Failed to mark all as read:', error)
  }
}

const getTagUnreadCount = (tag: string) => {
  const tagFeeds = feedsByTag.value[tag] || []
  return tagFeeds.reduce((sum, feed) => sum + feed.unreadCount, 0)
}

const getInboxUnreadCount = () => {
  const inboxFeeds = feedsByTag.value['__inbox__'] || []
  return inboxFeeds.reduce((sum, feed) => sum + feed.unreadCount, 0)
}

const handleSelectTag = (tag: string) => {
  selectedTag.value = tag
  selectedFeedId.value = null
}

const handleSyncAll = async () => {
  try {
    await syncAll()
  } catch (error) {
    console.error('Failed to sync all feeds:', error)
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
