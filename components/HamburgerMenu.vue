<template>
  <div>
    <!-- Hamburger Button -->
    <button
      @click="isOpen = true"
      class="fixed top-4 right-4 z-40 p-2 bg-white rounded-lg shadow-lg hover:bg-gray-50 transition-colors"
      aria-label="Open menu"
    >
      <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
      </svg>
    </button>

    <!-- Overlay -->
    <Transition name="fade">
      <div
        v-if="isOpen"
        @click="isOpen = false"
        class="fixed inset-0 bg-black bg-opacity-50 z-40"
      ></div>
    </Transition>

    <!-- Slide-in Menu -->
    <Transition name="slide">
      <div
        v-if="isOpen"
        class="fixed top-0 right-0 h-full w-96 bg-white shadow-2xl z-50 overflow-y-auto"
      >
        <!-- Menu Header -->
        <div class="flex items-center justify-between p-6 border-b">
          <h2 class="text-xl font-bold">Menu</h2>
          <button
            @click="isOpen = false"
            class="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Close menu"
          >
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
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

          <!-- Example Feeds -->
          <div class="space-y-3">
            <h3 class="font-semibold text-gray-900">Quick Add</h3>
            <div class="space-y-2">
              <button
                v-for="feed in exampleFeeds"
                :key="feed.url"
                @click="quickAddFeed(feed.url)"
                class="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                {{ feed.name }}
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
    </Transition>
  </div>
</template>

<script setup lang="ts">
const isOpen = ref(false)
const newFeedUrl = ref('')
const loading = ref(false)
const syncLoading = ref(false)
const error = ref<string | null>(null)
const success = ref<string | null>(null)

const { addFeed, syncAll, feeds } = useFeeds()
const { unreadArticles } = useArticles()

const exampleFeeds = [
  { name: 'Hacker News', url: 'https://hnrss.org/frontpage' },
  { name: 'TechCrunch', url: 'https://techcrunch.com/feed/' },
  { name: 'The Verge', url: 'https://www.theverge.com/rss/index.xml' },
  { name: 'Daring Fireball', url: 'https://daringfireball.net/feeds/main' }
]

const stats = computed(() => ({
  totalFeeds: feeds.value.length,
  unreadArticles: unreadArticles.value.length
}))

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

const quickAddFeed = async (url: string) => {
  newFeedUrl.value = url
  await handleAddFeed()
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

<style scoped>
/* Fade transition for overlay */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* Slide transition for menu */
.slide-enter-active,
.slide-leave-active {
  transition: transform 0.3s ease;
}

.slide-enter-from,
.slide-leave-to {
  transform: translateX(100%);
}
</style>
