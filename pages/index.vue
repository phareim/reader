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
              :all-tags-with-counts="allTagsWithCounts"
              @open="handleOpenArticle"
              @toggle-save="toggleSaveArticle"
              @update-tags="handleUpdateTags"
            />
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useKeyboardShortcuts } from '~/composables/useKeyboardShortcuts'
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

const {
  allTagsWithCounts,
  updateSavedArticleTags,
  fetchTags
} = useTags()

const {
  fetchSavedArticlesByTag
} = useSavedArticlesByTag()

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
  if (feedId === -1) {
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

// Navigation moved into keyboard shortcuts composable

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

    // Scroll to the article with smooth animation
    await nextTick()
    const articleElement = document.getElementById(`article-${id}`)
    if (articleElement) {
      articleElement.scrollIntoView({ behavior: "smooth", block: "start", inline: "nearest" })
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

// Register global keyboard shortcuts
useKeyboardShortcuts({
  helpDialogRef,
  toggleMenu,
  selectedArticleId,
  expandedArticleId,
  displayedArticles,
  selectedFeedId,
  markAsRead,
  refreshFeed,
  syncAll,
  toggleSaveArticle,
  handleOpenArticle,
  handleMarkAsRead,
  handleMarkAllRead
})
</script>

<style scoped>
Article {
  transition: transform 0.3s ease;
}
</style>