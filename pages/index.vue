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

        <!-- Empty State Component -->
        <EmptyState
          v-else-if="displayedArticles.length === 0"
          :type="feeds.length === 0 ? 'no-feeds' : 'all-caught-up'"
          :tags-with-unread="tagsWithUnreadCounts"
          :inbox-unread-count="getInboxUnreadCount()"
          :total-unread-count="totalUnreadCount"
          :has-unread-in-other-views="hasUnreadInOtherViews"
          @select-tag="handleSelectTag"
          @sync-all="handleSyncAll"
        />

        <!-- Article List -->
        <div v-else class="space-y-0">
          <ArticleListItem
            v-for="article in displayedArticles"
            :key="article.id"
            :article="article"
            :is-selected="selectedArticleId === article.id"
            :is-expanded="expandedArticleId === article.id"
            :is-saved="isSaved(article.id)"
            :show-feed-title="!selectedFeed"
            @open="handleOpenArticle"
            @toggle-save="toggleSaveArticle"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
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

// Computed properties for EmptyState component
const tagsWithUnreadCounts = computed(() => {
  return allTags.value
    .map(tag => ({
      name: tag,
      unreadCount: getTagUnreadCount(tag)
    }))
    .filter(tag => tag.unreadCount > 0)
})

const hasUnreadInOtherViews = computed(() => {
  return tagsWithUnreadCounts.value.length > 0 || getInboxUnreadCount() > 0
})
</script>
