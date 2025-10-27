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
        :current-article="article"
        :selected-feed="selectedFeed"
        :selected-feed-id="article?.feedId || null"
        :selected-tag="null"
        @toggle-menu="toggleMenu"
        @mark-all-read="() => {}"
        @refresh-feed="() => {}"
        @sync-all="handleSyncAll"
        @view-saved="handleViewSaved"
        @sign-out="handleSignOut"
        @success="handleHeaderSuccess"
        @error="handleHeaderError"
      />

      <!-- Loading State -->
      <div v-if="loading" class="flex items-center justify-center py-20">
        <div class="text-gray-500 dark:text-gray-400">Loading article...</div>
      </div>

      <!-- Error State -->
      <div v-else-if="error" class="flex flex-col items-center justify-center py-20 px-4">
        <div class="max-w-md text-center space-y-4">
          <svg class="w-16 h-16 mx-auto text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h2 class="text-xl font-bold text-gray-900 dark:text-gray-100">Article Not Found</h2>
          <p class="text-gray-600 dark:text-gray-400">{{ error }}</p>
          <NuxtLink
            to="/"
            class="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Articles
          </NuxtLink>
        </div>
      </div>

      <!-- Article Content -->
      <article v-else-if="article" class="max-w-4xl mx-auto px-6 py-8">
        <!-- Article Header -->
        <header class="mb-8 pb-6 border-b border-gray-200 dark:border-zinc-800">
          <h1 class="text-4xl font-bold font-spectral text-gray-900 dark:text-gray-100 mb-4">
            {{ article.title }}
          </h1>

          <div class="flex items-center justify-between flex-wrap gap-4 text-sm text-gray-600 dark:text-gray-400">
            <div class="flex items-center gap-4">
              <span v-if="article.feedTitle">{{ article.feedTitle }}</span>
              <span>{{ formatDate(article.publishedAt) }}</span>
              <span v-if="article.author">{{ article.author }}</span>
            </div>

            <div class="flex items-center gap-2">
              <!-- Read status -->
              <span v-if="!article.isRead" class="px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded">
                Unread
              </span>

              <!-- Saved status -->
              <span v-if="isSaved" class="px-2 py-1 text-xs bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 rounded flex items-center gap-1">
                <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M17 3H7c-1.1 0-2 .9-2 2v16l7-3 7 3V5c0-1.1-.9-2-2-2z"/>
                </svg>
                Saved
              </span>
            </div>
          </div>
        </header>

        <!-- Article Actions Bar -->
        <div class="mb-6 flex items-center justify-between flex-wrap gap-4 p-4 bg-white dark:bg-zinc-900 rounded-lg border border-gray-200 dark:border-zinc-800">
          <div class="flex items-center gap-2">
            <button
              @click="toggleSave"
              class="px-3 py-1.5 text-sm rounded-lg transition-colors flex items-center gap-2"
              :class="isSaved
                ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 hover:bg-yellow-200 dark:hover:bg-yellow-900/50'
                : 'bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-zinc-700'"
            >
              <svg class="w-4 h-4" :fill="isSaved ? 'currentColor' : 'none'" stroke="currentColor" viewBox="0 0 24 24">
                <path v-if="!isSaved" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"/>
                <path v-else d="M17 3H7c-1.1 0-2 .9-2 2v16l7-3 7 3V5c0-1.1-.9-2-2-2z"/>
              </svg>
              {{ isSaved ? 'Unsave' : 'Save' }}
            </button>

            <button
              @click="toggleRead"
              class="px-3 py-1.5 text-sm bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-zinc-700 rounded-lg transition-colors flex items-center gap-2"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {{ article.isRead ? 'Mark unread' : 'Mark read' }}
            </button>
          </div>

          <a
            :href="article.url"
            target="_blank"
            rel="noopener noreferrer"
            class="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center gap-2"
          >
            <span>Open original</span>
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/>
            </svg>
          </a>
        </div>

        <!-- Article Body -->
        <div class="prose prose-lg dark:prose-invert max-w-none font-spectral">
          <div
            v-if="processedContent"
            v-html="processedContent"
          ></div>
          <div v-else-if="article.summary" class="text-gray-700 dark:text-gray-300">
            {{ article.summary }}
          </div>
          <div v-else class="text-gray-500 dark:text-gray-400 italic">
            No content available for this article.
          </div>
        </div>

        <!-- Navigation Footer -->
        <footer class="mt-12 pt-6 border-t border-gray-200 dark:border-zinc-800">
          <div class="flex items-center justify-between gap-2 sm:gap-4">
            <!-- Previous Button (Left) -->
            <NuxtLink
              v-if="prevArticleId"
              :to="`/article/${prevArticleId}`"
              class="px-3 py-2 sm:px-4 sm:py-2.5 text-sm bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-zinc-700 rounded-lg transition-colors flex items-center gap-2 min-w-0 flex-shrink"
            >
              <svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
              </svg>
              <span class="hidden sm:inline">Previous</span>
            </NuxtLink>
            <div v-else class="w-[44px] sm:w-[76px]"></div>

            <!-- Back to Articles (Center) -->
            <NuxtLink
              to="/"
              class="px-3 py-2 sm:px-5 sm:py-2.5 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center gap-2 flex-shrink-0"
            >
              <svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
              <span class="hidden xs:inline sm:inline">All Articles</span>
            </NuxtLink>

            <!-- Next Button (Right) -->
            <NuxtLink
              v-if="nextArticleId"
              :to="`/article/${nextArticleId}`"
              class="px-3 py-2 sm:px-4 sm:py-2.5 text-sm bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-zinc-700 rounded-lg transition-colors flex items-center gap-2 min-w-0 flex-shrink"
            >
              <span class="hidden sm:inline">Next</span>
              <svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
              </svg>
            </NuxtLink>
            <div v-else class="w-[44px] sm:w-[76px]"></div>
          </div>
        </footer>
      </article>
    </div>
  </div>
</template>

<script setup lang="ts">
import { formatDistanceToNow } from 'date-fns'
import { useKeyboardShortcuts } from '~/composables/useKeyboardShortcuts'

definePageMeta({
  auth: true
})

const route = useRoute()
const router = useRouter()
const articleId = computed(() => parseInt(route.params.id as string))

const { data: session } = useAuth()

const {
  feeds,
  fetchFeeds,
  syncAll
} = useFeeds()

const {
  selectedArticleId,
  markAsRead,
  fetchArticles
} = useArticles()

const {
  isSaved: checkSaved,
  toggleSave: toggleSaveAction,
  fetchSavedArticleIds
} = useSavedArticles()

// Local state
const article = ref<any>(null)
const loading = ref(true)
const error = ref<string | null>(null)
const prevArticleId = ref<number | null>(null)
const nextArticleId = ref<number | null>(null)

// Reference to hamburger menu
const hamburgerMenuRef = ref<any>(null)
const menuIsOpen = computed(() => hamburgerMenuRef.value?.isOpen ?? false)

// Reference to help dialog
const helpDialogRef = ref<any>(null)

const toggleMenu = () => {
  if (hamburgerMenuRef.value) {
    hamburgerMenuRef.value.isOpen = !hamburgerMenuRef.value.isOpen
  }
}

// Computed properties
const isSaved = computed(() => checkSaved(articleId.value))

const selectedFeed = computed(() => {
  if (!article.value?.feedId) return null
  return feeds.value.find(f => f.id === article.value.feedId) || null
})

// Process article content to make all links open in new tabs
const processedContent = computed(() => {
  if (!article.value?.content) return null

  // Create a temporary div to parse the HTML
  const div = document.createElement('div')
  div.innerHTML = article.value.content

  // Find all links and add target="_blank" and rel
  const links = div.querySelectorAll('a')
  links.forEach(link => {
    link.setAttribute('target', '_blank')
    link.setAttribute('rel', 'noopener noreferrer')
  })

  return div.innerHTML
})

// Fetch article data
const fetchArticle = async () => {
  loading.value = true
  error.value = null

  try {
    const response = await $fetch(`/api/articles/${articleId.value}`)
    article.value = response

    // Mark as read on open
    if (!article.value.isRead) {
      await markAsRead(articleId.value, true)
      article.value.isRead = true
    }

    // Fetch feed articles to determine prev/next
    await fetchAdjacentArticles()
  } catch (e: any) {
    console.error('Failed to fetch article:', e)
    error.value = e.statusMessage || 'Failed to load article'
  } finally {
    loading.value = false
  }
}

// Fetch adjacent articles from the same feed
const fetchAdjacentArticles = async () => {
  if (!article.value?.feedId) {
    prevArticleId.value = null
    nextArticleId.value = null
    return
  }

  try {
    // Fetch all articles from the same feed
    const response = await $fetch('/api/articles', {
      params: {
        feedId: article.value.feedId,
        limit: 200  // Get more articles to ensure we have context
      }
    })

    const feedArticles = response.articles || []

    // Find current article index
    const currentIndex = feedArticles.findIndex((a: any) => a.id === articleId.value)

    if (currentIndex === -1) {
      prevArticleId.value = null
      nextArticleId.value = null
      return
    }

    // Set previous and next article IDs
    prevArticleId.value = currentIndex > 0 ? feedArticles[currentIndex - 1].id : null
    nextArticleId.value = currentIndex < feedArticles.length - 1 ? feedArticles[currentIndex + 1].id : null
  } catch (e) {
    console.error('Failed to fetch adjacent articles:', e)
    prevArticleId.value = null
    nextArticleId.value = null
  }
}

// Actions
const toggleSave = async () => {
  try {
    await toggleSaveAction(articleId.value)
  } catch (e) {
    console.error('Failed to toggle save:', e)
  }
}

const toggleRead = async () => {
  try {
    await markAsRead(articleId.value, !article.value.isRead)
    article.value.isRead = !article.value.isRead
  } catch (e) {
    console.error('Failed to toggle read:', e)
  }
}

const handleSyncAll = async () => {
  try {
    await syncAll()
  } catch (e) {
    console.error('Failed to sync all:', e)
  }
}

const handleViewSaved = () => {
  router.push('/')
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

const formatDate = (date?: string) => {
  if (!date) return 'Unknown date'
  try {
    return formatDistanceToNow(new Date(date), { addSuffix: true })
  } catch {
    return 'Unknown date'
  }
}

// Lifecycle
onMounted(async () => {
  if (session.value?.user) {
    await Promise.all([
      fetchFeeds(),
      fetchSavedArticleIds(),
      fetchArticle()
    ])
  }
})

// Watch for route changes (next/prev navigation)
watch(() => route.params.id, async () => {
  if (route.params.id) {
    await fetchArticle()
  }
})

// Custom keyboard handler for article view
const handleArticleKeydown = (e: KeyboardEvent) => {
  // Ignore if typing in an input field
  const target = e.target as HTMLElement
  if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
    return
  }

  // Escape: go to article overview
  if (e.key === 'Escape') {
    e.preventDefault()
    router.push('/')
    return
  }

  // o: open original article URL
  if (e.key === 'o' && article.value?.url) {
    e.preventDefault()
    window.open(article.value.url, '_blank', 'noopener,noreferrer')
    return
  }

  // j: next article
  if (e.key === 'j' && nextArticleId.value) {
    e.preventDefault()
    router.push(`/article/${nextArticleId.value}`)
    return
  }

  // k: previous article
  if (e.key === 'k' && prevArticleId.value) {
    e.preventDefault()
    router.push(`/article/${prevArticleId.value}`)
    return
  }
}

// Swipe gesture handling
let touchStartX = 0
let touchStartY = 0
let touchEndX = 0
let touchEndY = 0

const minSwipeDistance = 50 // Minimum distance in pixels to register as a swipe

const handleTouchStart = (e: TouchEvent) => {
  touchStartX = e.changedTouches[0].screenX
  touchStartY = e.changedTouches[0].screenY
}

const handleTouchEnd = (e: TouchEvent) => {
  touchEndX = e.changedTouches[0].screenX
  touchEndY = e.changedTouches[0].screenY
  handleSwipe()
}

const handleSwipe = () => {
  const deltaX = touchEndX - touchStartX
  const deltaY = touchEndY - touchStartY

  // Ensure horizontal swipe is more significant than vertical
  if (Math.abs(deltaX) < minSwipeDistance || Math.abs(deltaY) > Math.abs(deltaX)) {
    return
  }

  // Swipe left -> next article
  if (deltaX < 0 && nextArticleId.value) {
    router.push(`/article/${nextArticleId.value}`)
  }

  // Swipe right -> previous article
  if (deltaX > 0 && prevArticleId.value) {
    router.push(`/article/${prevArticleId.value}`)
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleArticleKeydown)
  window.addEventListener('touchstart', handleTouchStart)
  window.addEventListener('touchend', handleTouchEnd)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleArticleKeydown)
  window.removeEventListener('touchstart', handleTouchStart)
  window.removeEventListener('touchend', handleTouchEnd)
})

// Register keyboard shortcuts for article actions
useKeyboardShortcuts({
  helpDialogRef,
  toggleMenu,
  selectedArticleId: computed(() => articleId.value),
  displayedArticles: computed(() => article.value ? [article.value] : []),
  selectedFeedId: computed(() => article.value?.feedId || null),
  showUnreadOnly: computed(() => false),
  markAsRead,
  refreshFeed: async (feedId: number) => {
    if (feedId) {
      await refreshFeed(feedId)
    }
  },
  syncAll,
  toggleSaveArticle: async () => {
    await toggleSave()
  },
  handleMarkAsRead: async () => {
    if (article.value && !article.value.isRead) {
      await markAsRead(articleId.value, true)
      article.value.isRead = true
    }
  },
  handleMarkAllRead: async () => {
    // Not applicable in article view
  }
})
</script>
