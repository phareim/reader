<template>
  <div class="min-h-screen bg-gray-50 dark:bg-dark-bg">
    <!-- Hamburger Menu -->
    <HamburgerMenu ref="hamburgerMenuRef" />

    <!-- Keyboard Shortcuts Help Dialog -->
    <KeyboardShortcutsHelp ref="helpDialogRef" />

    <!-- Main Content Area -->
    <div class="min-h-screen transition-all duration-300 ease-in-out"
      :style="{ marginLeft: menuIsOpen ? '20rem' : '0' }">
      <!-- Sticky Header -->
      <PageHeader :menu-is-open="menuIsOpen" :current-article="null" :selected-feed="selectedFeed"
        :selected-feed-id="selectedFeedId" :selected-tag="selectedTag"
        :unread-count="articleCounts.unreadCount" :total-count="articleCounts.totalCount"
        @toggle-menu="toggleMenu"
        @mark-all-read="handleMarkAllRead" @refresh-feed="handleRefreshFeed" @sync-all="handleSyncAll"
        @view-saved="handleViewSaved" @sign-out="handleSignOut" @success="handleHeaderSuccess"
        @error="handleHeaderError" />

      <!-- Articles List (Full Width) -->
      <div class="py-0">
        <!-- Success/Error Messages -->
        <div v-if="headerSuccess || headerError" class="px-6 py-4">
          <p v-if="headerSuccess" class="text-base text-green-500 dark:text-green-400">{{ headerSuccess }}</p>
          <p v-if="headerError" class="text-base text-red-500 dark:text-red-400">{{ headerError }}</p>
        </div>

        <!-- Not Logged In State -->
        <div v-if="!session?.user" class="flex flex-col items-center justify-center py-20 px-4">
          <div class="max-w-md text-center space-y-6">
            <svg class="w-20 h-20 mx-auto text-gray-400 dark:text-zinc-600" fill="none" stroke="currentColor"
              viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
            <h2 class="text-2xl font-bold text-gray-900 dark:text-gray-100">
              <img :src="booksStackIcon" alt="Stack of books"
                class="w-10 h-10 mx-auto text-gray-400 dark:text-zinc-600" />
              Hello!
            </h2>
            <p class="text-gray-600 dark:text-gray-400">
              Your friendly librarian for organizing and curating the web's knowledge.
            </p>
            <NuxtLink to="/login"
              class="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Sign In to Get Started
            </NuxtLink>
          </div>
        </div>

        <!-- Logged In Content -->
        <template v-else>
          <div v-if="articlesLoading" class="text-center text-gray-500 dark:text-gray-400 py-8">Loading...</div>

          <!-- Empty State Component (shown when no articles OR in overview mode) -->
          <EmptyState v-else-if="selectedFeedId === -2 || displayedArticles.length === 0"
            :type="feeds.length === 0 ? 'no-feeds' : 'all-caught-up'" :tags-with-unread="tagsWithUnreadCounts"
            :inbox-unread-count="getInboxUnreadCount()" :total-unread-count="totalUnreadCount"
            :has-unread-in-other-views="hasUnreadInOtherViews" @select-tag="handleSelectTag"
            @sync-all="handleSyncAll" />

          <!-- Article Grid -->
          <div v-else class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 p-4">
            <TransitionGroup name="card-list" tag="div" class="contents">
              <LazyArticleCard v-for="article in displayedArticles" :key="article.id" :article="article"
                :is-selected="selectedArticleId === article.id" :is-saved="isSaved(article.id)"
                :show-feed-title="!selectedFeed" :all-tags-with-counts="allTagsWithCounts"
                @toggle-save="toggleSaveArticle(article.id)" @toggle-read="handleToggleRead(article.id)"
                @update-tags="handleUpdateTags" @swipe-dismiss="handleSwipeDismiss(article.id)" />
            </TransitionGroup>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useKeyboardShortcuts } from '~/composables/useKeyboardShortcuts'
import booksStackIcon from '~/assets/svg/books-stack-of-three-svgrepo-com.svg'
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
  unreadArticles,
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

// Track dismissed articles for smooth removal animation
const dismissedArticleIds = ref<Set<number>>(new Set())

// Compute article counts for header
const articleCounts = computed(() => {
  if (selectedFeedId.value === -1) {
    // Saved articles - show total count
    return { unreadCount: 0, totalCount: articles.value.length }
  } else {
    // Other views - show unread count
    return { unreadCount: unreadArticles.value.length, totalCount: 0 }
  }
})

// Override displayedArticles to ignore unread filter when viewing saved articles + apply search
const displayedArticles = computed(() => {
  let articlesToDisplay
  // When viewing saved articles (feedId === -1), show all saved articles
  if (selectedFeedId.value === -1) {
    articlesToDisplay = articles.value
  } else {
    // Otherwise use the default filtering from useArticles
    articlesToDisplay = _displayedArticles.value
  }

  // Apply search filter
  articlesToDisplay = filterArticles(articlesToDisplay, searchQuery.value)

  // Filter out dismissed articles
  return articlesToDisplay.filter(a => !dismissedArticleIds.value.has(a.id))
})

// Reference to hamburger menu to track its open state
const hamburgerMenuRef = ref<any>(null)
const menuIsOpen = computed(() => hamburgerMenuRef.value?.isOpen ?? false)

// Reference to help dialog
const helpDialogRef = ref<any>(null)

// Keyboard shortcuts are registered via composable

const toggleMenu = () => {
  if (hamburgerMenuRef.value) {
    hamburgerMenuRef.value.isOpen = !hamburgerMenuRef.value.isOpen
  }
}

// Toggle save/unsave article
const toggleSaveArticle = async (articleId: number) => {
  try {
    await toggleSave(articleId)
    // Refresh saved articles organization
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

// Handle swipe dismiss - remove article from local display immediately
const handleSwipeDismiss = (articleId: number) => {
  // The toggle-save or toggle-read events have already been emitted
  // Just need to mark as dismissed for smooth animation
  dismissedArticleIds.value.add(articleId)
}

// Update tags for a saved article
const handleUpdateTags = async (savedArticleId: number, tags: string[]) => {
  // Find the article with this savedId and optimistically update its tags
  const article = articles.value.find(a => a.savedId === savedArticleId)
  const previousTags = article?.tags || []

  if (article) {
    article.tags = tags
  }

  try {
    await updateSavedArticleTags(savedArticleId, tags)
    // Refresh tag counts and saved articles organization
    await Promise.all([
      fetchTags(),
      fetchSavedArticlesByTag()
    ])
  } catch (error) {
    console.error('Failed to update tags:', error)
    // Revert optimistic update on error
    if (article) {
      article.tags = previousTags
    }
  }
}

// Load feeds and saved articles on mount (only if logged in)
onMounted(async () => {
  if (session.value?.user) {
    await Promise.all([
      fetchFeeds(),
      fetchSavedArticleIds(),
      fetchTags(),
      fetchSavedArticlesByTag()
    ])
  }
})

// Watch for session changes to fetch data when user logs in
watch(() => session.value?.user, async (user) => {
  if (user) {
    await Promise.all([
      fetchFeeds(),
      fetchSavedArticleIds(),
      fetchTags(),
      fetchSavedArticlesByTag()
    ])
  }
})

// Watch for feed or tag selection changes
watch([selectedFeedId, selectedTag], async ([feedId, tag]) => {
  // Clear dismissed articles when changing views
  dismissedArticleIds.value.clear()

  if (feedId === -2) {
    // Overview mode - don't fetch articles, just show the EmptyState
    return
  } else if (feedId === -1) {
    // Saved articles selected
    if (tag && tag !== '__saved_untagged__') {
      // Filter saved articles by tag
      await fetchArticles(-1, undefined, tag)
    } else if (tag === '__saved_untagged__') {
      // Show untagged saved articles (we'll need to handle this in the API)
      await fetchArticles(-1, undefined, '__inbox__')
    } else {
      // Show all saved articles
      await fetchArticles(-1)
    }
  } else if (feedId !== null) {
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

// Clear selected article if it's no longer in the displayed list
watch(displayedArticles, () => {
  if (selectedArticleId.value !== null) {
    const stillExists = displayedArticles.value.some(a => a.id === selectedArticleId.value)
    if (!stillExists) {
      selectedArticleId.value = null
    }
  }
})

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
      // Mark all in tag - optimistically update all at once, then call API for each
      const articlesToMark = displayedArticles.value.filter(a => !a.isRead)

      // Optimistically update all articles at once
      articlesToMark.forEach(article => {
        article.isRead = true
        article.readAt = new Date().toISOString()
      })

      // Then make API calls in background without awaiting each one
      Promise.all(articlesToMark.map(article =>
        markAsRead(article.id, true).catch(err => {
          // Revert on error
          article.isRead = false
          article.readAt = null
          console.error('Failed to mark article as read:', err)
        })
      ))
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

// Header menu handlers
const handleRefreshFeed = async () => {
  if (selectedFeedId.value && selectedFeedId.value > 0) {
    await refreshFeed(selectedFeedId.value)
  }
}

const handleViewSaved = () => {
  selectedFeedId.value = -1
  selectedTag.value = null
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

// Register global keyboard shortcuts
useKeyboardShortcuts({
  helpDialogRef,
  toggleMenu,
  selectedArticleId,
  displayedArticles,
  selectedFeedId,
  showUnreadOnly,
  markAsRead,
  refreshFeed,
  syncAll,
  toggleSaveArticle,
  handleMarkAsRead,
  handleMarkAllRead
})
</script>

<style scoped>
Article {
  transition: transform 0.3s ease;
}

/* Card list transitions for smooth removal */
.card-list-move {
  transition: all 0.5s ease;
}

.card-list-leave-active {
  position: absolute;
}

.card-list-leave-to {
  opacity: 0;
}
</style>