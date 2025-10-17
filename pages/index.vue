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
        :current-article="currentScrolledArticle"
        :selected-feed="selectedFeed"
        :selected-feed-id="selectedFeedId"
        :selected-tag="selectedTag"
        @toggle-menu="toggleMenu"
      />

      <!-- Articles List (Full Width) -->
      <div class="py-0">
        <!-- Not Logged In State -->
        <div v-if="!session?.user" class="flex flex-col items-center justify-center py-20 px-4">
          <div class="max-w-md text-center space-y-6">
            <svg class="w-20 h-20 mx-auto text-gray-400 dark:text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
            <h2 class="text-2xl font-bold text-gray-900 dark:text-gray-100">Welcome to Vibe Reader</h2>
            <p class="text-gray-600 dark:text-gray-400">
              Your personal RSS reader for staying up to date.
            </p>
            <NuxtLink
              to="/login"
              class="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Sign In to Get Started
            </NuxtLink>
          </div>
        </div>

        <!-- Logged In Content -->
        <template v-else>
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
            <Article
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
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  auth: false
})

const { data: session } = useAuth()

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

// Show expanded article in sticky header
const currentScrolledArticle = computed(() => {
  if (expandedArticleId.value === null) return null
  return displayedArticles.value.find(a => a.id === expandedArticleId.value) || null
})

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

// Load feeds and saved articles on mount (only if logged in)
onMounted(async () => {
  if (session.value?.user) {
    await Promise.all([
      fetchFeeds(),
      fetchSavedArticleIds()
    ])
  }

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

// Watch for session changes to fetch data when user logs in
watch(() => session.value?.user, async (user) => {
  if (user) {
    await Promise.all([
      fetchFeeds(),
      fetchSavedArticleIds()
    ])
  }
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
