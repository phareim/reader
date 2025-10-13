<template>
  <div>
    <!-- Slide-in Menu -->
    <div
      class="fixed top-0 left-0 h-full w-80 bg-white shadow-2xl z-30 overflow-y-auto transition-transform duration-300 ease-in-out"
      :class="isOpen ? 'translate-x-0' : '-translate-x-full'"
    >
        <!-- Menu Header -->
        <div class="flex items-center justify-between p-6 border-b">
          <h2 class="text-xl font-bold">Vibe Reader</h2>
        </div>

        <!-- User Profile Section -->
        <div class="p-6 border-b bg-gradient-to-r from-blue-50 to-purple-50">
          <div class="flex items-center gap-3">
            <img
              v-if="session?.user?.image"
              :src="session.user.image"
              :alt="session.user.name"
              class="w-12 h-12 rounded-full border-2 border-white shadow-md"
            />
            <div v-else class="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-semibold text-xl shadow-md">
              {{ session?.user?.name?.charAt(0) || '?' }}
            </div>
            <div class="flex-1 min-w-0">
              <p class="font-semibold text-gray-900 truncate">{{ session?.user?.name }}</p>
              <p class="text-xs text-gray-600 truncate">{{ session?.user?.email }}</p>
            </div>
          </div>
          <button
            @click="handleSignOut"
            class="w-full mt-3 px-4 py-2 text-sm text-red-600 bg-white hover:bg-red-50 rounded-lg transition-colors border border-red-200"
          >
            Sign Out
          </button>
        </div>

        <!-- Menu Content -->
        <div class="p-6 space-y-6">
          <!-- Add Feed Section -->
          <div class="space-y-3">
            <h3 class="font-semibold text-gray-900">Add Feed</h3>
            <input
              v-model="newFeedUrl"
              type="url"
              placeholder="Enter URL or RSS feed URL..."
              class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              @keyup.enter="handleDiscoverOrAddFeed"
            />
            <div class="flex gap-2">
              <button
                @click="handleDiscoverFeeds"
                :disabled="!newFeedUrl.trim() || discovering"
                class="flex-1 px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {{ discovering ? 'Discovering...' : 'Discover Feeds' }}
              </button>
              <button
                @click="handleAddFeed"
                :disabled="!newFeedUrl.trim() || loading"
                class="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {{ loading ? 'Adding...' : 'Add Direct' }}
              </button>
            </div>
            <p v-if="error" class="text-sm text-red-500">{{ error }}</p>
            <p v-if="success" class="text-sm text-green-500">{{ success }}</p>

            <!-- Discovered Feeds List -->
            <div v-if="discoveredFeeds.length > 0" class="mt-3 space-y-2 p-3 bg-purple-50 rounded-lg">
              <h4 class="text-sm font-semibold text-purple-900">Discovered Feeds:</h4>
              <div class="space-y-1">
                <button
                  v-for="(feed, index) in discoveredFeeds"
                  :key="index"
                  @click="addDiscoveredFeed(feed.url)"
                  class="w-full text-left px-3 py-2 text-sm bg-white hover:bg-purple-100 rounded border border-purple-200 transition-colors"
                >
                  <div class="font-medium text-purple-900">{{ feed.title }}</div>
                  <div class="text-xs text-purple-600 truncate">{{ feed.url }}</div>
                </button>
              </div>
            </div>
          </div>

          <!-- Feeds List -->
          <div class="space-y-3">
            <h3 class="font-semibold text-gray-900">Feeds ({{ feeds.length }})</h3>
            <div v-if="feeds.length === 0" class="text-sm text-gray-500">No feeds yet</div>
            <div v-else class="space-y-1">
              <div
                v-for="feed in feeds"
                :key="feed.id"
                class="flex items-center gap-1"
              >
                <button
                  @click="selectFeed(feed.id)"
                  class="flex-1 text-left px-3 py-2 text-sm rounded-lg transition-colors flex items-center gap-2"
                  :class="selectedFeedId === feed.id ? 'bg-blue-100 text-blue-900' : 'text-gray-700 hover:bg-gray-100'"
                >
                  <img v-if="feed.faviconUrl" :src="feed.faviconUrl" alt="" class="w-4 h-4" />
                  <span class="flex-1 truncate">{{ feed.title }}</span>
                  <span v-if="feed.unreadCount > 0" class="text-xs bg-blue-500 text-white px-2 py-0.5 rounded-full">{{ feed.unreadCount }}</span>
                </button>
                <button
                  @click="handleDeleteFeed(feed.id, feed.title)"
                  class="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                  title="Delete feed"
                  aria-label="Delete feed"
                >
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          <!-- Menu Divider -->
          <hr class="border-gray-200">

          <!-- Other Menu Items -->
          <div class="space-y-2">
            <button
              @click="handleSyncAll"
              :disabled="syncLoading"
              class="w-full text-left px-3 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors flex items-center gap-2"
            >
              <svg class="w-5 h-5" :class="{ 'animate-spin': syncLoading }" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span>{{ syncLoading ? 'Syncing...' : 'Sync All Feeds' }}</span>
            </button>

            <button
              class="w-full text-left px-3 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors flex items-center gap-2"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span>Settings</span>
            </button>

            <button
              class="w-full text-left px-3 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors flex items-center gap-2"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>About</span>
            </button>
          </div>

          <!-- Stats Section -->
          <div class="pt-4 border-t border-gray-200">
            <div class="text-sm text-gray-500 space-y-1">
              <div class="flex justify-between">
                <span>Total Feeds:</span>
                <span class="font-medium text-gray-900">{{ stats.totalFeeds }}</span>
              </div>
              <div class="flex justify-between">
                <span>Unread Articles:</span>
                <span class="font-medium text-gray-900">{{ stats.unreadArticles }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
  </div>
</template>

<script setup lang="ts">
const isOpen = ref(false)
const newFeedUrl = ref('')
const loading = ref(false)
const discovering = ref(false)
const syncLoading = ref(false)
const error = ref<string | null>(null)
const success = ref<string | null>(null)
const discoveredFeeds = ref<Array<{ url: string; title: string; type: string }>>([])

const { addFeed, syncAll, deleteFeed, feeds, selectedFeedId } = useFeeds()
const { unreadArticles } = useArticles()
const { data: session, signOut } = useAuth()

const stats = computed(() => ({
  totalFeeds: feeds.value.length,
  unreadArticles: unreadArticles.value.length
}))

const toggleMenu = () => {
  isOpen.value = !isOpen.value
}

const selectFeed = (feedId: number) => {
  selectedFeedId.value = feedId
}

const handleDiscoverFeeds = async () => {
  if (!newFeedUrl.value.trim()) return

  discovering.value = true
  error.value = null
  success.value = null
  discoveredFeeds.value = []

  try {
    const response = await $fetch<{ feeds: Array<{ url: string; title: string; type: string }> }>('/api/feeds/discover', {
      method: 'POST',
      body: { url: newFeedUrl.value }
    })

    discoveredFeeds.value = response.feeds
    success.value = `Found ${response.feeds.length} feed(s)! Click one to add it.`

    // Clear success message after 5 seconds
    setTimeout(() => {
      success.value = null
    }, 5000)
  } catch (err: any) {
    error.value = err.data?.message || err.message || 'Failed to discover feeds'
  } finally {
    discovering.value = false
  }
}

const addDiscoveredFeed = async (feedUrl: string) => {
  loading.value = true
  error.value = null
  success.value = null

  try {
    await addFeed(feedUrl)
    success.value = 'Feed added successfully!'
    discoveredFeeds.value = []
    newFeedUrl.value = ''

    setTimeout(() => {
      success.value = null
    }, 3000)
  } catch (err: any) {
    error.value = err.data?.message || err.message || 'Failed to add feed'
  } finally {
    loading.value = false
  }
}

const handleAddFeed = async () => {
  if (!newFeedUrl.value.trim()) return

  loading.value = true
  error.value = null
  success.value = null

  try {
    await addFeed(newFeedUrl.value)
    success.value = 'Feed added successfully!'
    newFeedUrl.value = ''
    discoveredFeeds.value = []

    // Clear success message after 3 seconds
    setTimeout(() => {
      success.value = null
    }, 3000)
  } catch (err: any) {
    error.value = err.data?.message || err.message || 'Failed to add feed'
  } finally {
    loading.value = false
  }
}

const handleDiscoverOrAddFeed = async () => {
  // Try to discover feeds first, if that fails, try adding directly
  await handleDiscoverFeeds()
  if (discoveredFeeds.value.length === 0 && !error.value) {
    await handleAddFeed()
  }
}

const handleSyncAll = async () => {
  syncLoading.value = true
  error.value = null

  try {
    const result = await syncAll()
    success.value = `Synced ${result.summary.total} feeds. ${result.summary.newArticles} new articles.`

    setTimeout(() => {
      success.value = null
    }, 3000)
  } catch (err: any) {
    error.value = 'Failed to sync feeds'
  } finally {
    syncLoading.value = false
  }
}

const handleSignOut = async () => {
  await signOut({ callbackUrl: '/login' })
}

const handleDeleteFeed = async (feedId: number, feedTitle: string) => {
  if (!confirm(`Are you sure you want to delete "${feedTitle}"?\n\nThis will also delete all articles from this feed.`)) {
    return
  }

  error.value = null
  success.value = null

  try {
    await deleteFeed(feedId)
    success.value = 'Feed deleted successfully!'

    setTimeout(() => {
      success.value = null
    }, 3000)
  } catch (err: any) {
    error.value = err.data?.message || err.message || 'Failed to delete feed'
  }
}

// Expose isOpen state to parent
defineExpose({
  isOpen
})

// Close menu on Escape key
onMounted(() => {
  const handleEscape = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && isOpen.value) {
      isOpen.value = false
    }
  }
  window.addEventListener('keydown', handleEscape)

  onUnmounted(() => {
    window.removeEventListener('keydown', handleEscape)
  })
})
</script>
