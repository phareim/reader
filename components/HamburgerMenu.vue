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

        <!-- Menu Content -->
        <div class="p-6 space-y-6">
          <!-- Add Feed Section -->
          <div class="space-y-3">
            <h3 class="font-semibold text-gray-900">Add Feed</h3>
            <input
              v-model="newFeedUrl"
              type="url"
              placeholder="Enter RSS feed URL..."
              class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              @keyup.enter="handleAddFeed"
            />
            <button
              @click="handleAddFeed"
              :disabled="!newFeedUrl.trim() || loading"
              class="w-full px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {{ loading ? 'Adding...' : 'Add Feed' }}
            </button>
            <p v-if="error" class="text-sm text-red-500">{{ error }}</p>
            <p v-if="success" class="text-sm text-green-500">{{ success }}</p>
          </div>

          <!-- Feeds List -->
          <div class="space-y-3">
            <h3 class="font-semibold text-gray-900">Feeds ({{ feeds.length }})</h3>
            <div v-if="feeds.length === 0" class="text-sm text-gray-500">No feeds yet</div>
            <div v-else class="space-y-1">
              <button
                v-for="feed in feeds"
                :key="feed.id"
                @click="selectFeed(feed.id)"
                class="w-full text-left px-3 py-2 text-sm rounded-lg transition-colors flex items-center gap-2"
                :class="selectedFeedId === feed.id ? 'bg-blue-100 text-blue-900' : 'text-gray-700 hover:bg-gray-100'"
              >
                <img v-if="feed.faviconUrl" :src="feed.faviconUrl" alt="" class="w-4 h-4" />
                <span class="flex-1 truncate">{{ feed.title }}</span>
                <span v-if="feed.unreadCount > 0" class="text-xs bg-blue-500 text-white px-2 py-0.5 rounded-full">{{ feed.unreadCount }}</span>
              </button>
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
const syncLoading = ref(false)
const error = ref<string | null>(null)
const success = ref<string | null>(null)

const { addFeed, syncAll, feeds, selectedFeedId } = useFeeds()
const { unreadArticles } = useArticles()

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

const handleAddFeed = async () => {
  if (!newFeedUrl.value.trim()) return

  loading.value = true
  error.value = null
  success.value = null

  try {
    await addFeed(newFeedUrl.value)
    success.value = 'Feed added successfully!'
    newFeedUrl.value = ''

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
