<template>
  <div class="min-h-screen bg-gray-50">
    <div class="container mx-auto p-4">
      <h1 class="text-2xl font-bold mb-4">RSS Reader MVP - Testing</h1>

      <!-- Add Feed Form -->
      <div class="bg-white p-4 rounded shadow mb-4">
        <h2 class="font-semibold mb-2">Add Feed</h2>
        <div class="flex gap-2">
          <input
            v-model="newFeedUrl"
            type="url"
            placeholder="Enter RSS feed URL..."
            class="flex-1 px-3 py-2 border rounded"
            @keyup.enter="handleAddFeed"
          />
          <button
            @click="handleAddFeed"
            :disabled="feedsLoading"
            class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
          >
            Add
          </button>
          <button
            @click="handleSync"
            :disabled="feedsLoading"
            class="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
          >
            Sync All
          </button>
        </div>
        <div v-if="feedsError" class="mt-2 text-red-500 text-sm">{{ feedsError }}</div>
        <div class="mt-2 text-sm text-gray-600">
          Test feeds:
          <button @click="newFeedUrl = 'https://hnrss.org/frontpage'" class="text-blue-500">Hacker News</button> |
          <button @click="newFeedUrl = 'https://techcrunch.com/feed/'" class="text-blue-500">TechCrunch</button>
        </div>
      </div>

      <!-- Feeds List -->
      <div class="bg-white p-4 rounded shadow mb-4">
        <h2 class="font-semibold mb-2">Feeds ({{ feeds.length }})</h2>
        <div v-if="feedsLoading" class="text-gray-500">Loading...</div>
        <div v-else-if="feeds.length === 0" class="text-gray-500">No feeds yet. Add one above!</div>
        <div v-else class="space-y-2">
          <div
            v-for="feed in feeds"
            :key="feed.id"
            class="flex items-center justify-between p-2 border rounded hover:bg-gray-50"
            :class="{ 'bg-blue-50': selectedFeedId === feed.id }"
          >
            <div class="flex items-center gap-2 flex-1 cursor-pointer" @click="handleSelectFeed(feed.id)">
              <img v-if="feed.faviconUrl" :src="feed.faviconUrl" alt="" class="w-4 h-4" />
              <span class="font-medium">{{ feed.title }}</span>
              <span v-if="feed.unreadCount > 0" class="text-sm text-blue-600">({{ feed.unreadCount }})</span>
            </div>
            <button
              @click="handleDeleteFeed(feed.id)"
              class="px-2 py-1 text-sm text-red-500 hover:bg-red-50 rounded"
            >
              Delete
            </button>
          </div>
        </div>
      </div>

      <!-- Articles List -->
      <div class="bg-white p-4 rounded shadow">
        <div class="flex items-center justify-between mb-2">
          <h2 class="font-semibold">
            Articles ({{ displayedArticles.length }})
            <span v-if="selectedFeed"> - {{ selectedFeed.title }}</span>
          </h2>
          <div class="flex gap-2">
            <label class="flex items-center gap-1 text-sm">
              <input v-model="showUnreadOnly" type="checkbox" />
              Unread only
            </label>
            <button
              v-if="displayedArticles.length > 0"
              @click="handleMarkAllRead"
              class="px-3 py-1 text-sm bg-gray-200 rounded hover:bg-gray-300"
            >
              Mark all read
            </button>
          </div>
        </div>
        <div v-if="articlesLoading" class="text-gray-500">Loading...</div>
        <div v-else-if="displayedArticles.length === 0" class="text-gray-500">No articles to display</div>
        <div v-else class="space-y-2 max-h-96 overflow-y-auto">
          <div
            v-for="article in displayedArticles"
            :key="article.id"
            class="p-3 border rounded hover:bg-gray-50 cursor-pointer"
            :class="{
              'bg-blue-50': selectedArticleId === article.id,
              'font-bold': !article.isRead
            }"
            @click="handleSelectArticle(article.id)"
          >
            <div class="flex items-start justify-between">
              <div class="flex-1">
                <div class="font-medium">{{ article.title }}</div>
                <div class="text-sm text-gray-600 mt-1">
                  {{ article.feedTitle }} • {{ formatDate(article.publishedAt) }}
                </div>
              </div>
              <span v-if="!article.isRead" class="text-blue-500 text-xl">•</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Selected Article -->
      <div v-if="selectedArticle" class="bg-white p-4 rounded shadow mt-4">
        <h2 class="text-xl font-bold mb-2">{{ selectedArticle.title }}</h2>
        <div class="text-sm text-gray-600 mb-4">
          By {{ selectedArticle.author || 'Unknown' }} • {{ formatDate(selectedArticle.publishedAt) }}
          <a :href="selectedArticle.url" target="_blank" class="text-blue-500 ml-2">Open original →</a>
        </div>
        <div
          v-if="selectedArticle.content"
          class="prose max-w-none"
          v-html="selectedArticle.content"
        ></div>
        <div v-else-if="selectedArticle.summary" class="text-gray-700">
          {{ selectedArticle.summary }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { formatDistanceToNow } from 'date-fns'

const {
  feeds,
  selectedFeedId,
  selectedFeed,
  loading: feedsLoading,
  error: feedsError,
  fetchFeeds,
  addFeed,
  deleteFeed,
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

const newFeedUrl = ref('')

// Load feeds on mount
onMounted(async () => {
  await fetchFeeds()
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

const handleAddFeed = async () => {
  if (!newFeedUrl.value.trim()) return

  try {
    await addFeed(newFeedUrl.value)
    newFeedUrl.value = ''
  } catch (error) {
    console.error('Failed to add feed:', error)
  }
}

const handleDeleteFeed = async (id: number) => {
  if (confirm('Are you sure you want to delete this feed?')) {
    try {
      await deleteFeed(id)
    } catch (error) {
      console.error('Failed to delete feed:', error)
    }
  }
}

const handleSelectFeed = async (id: number) => {
  selectedFeedId.value = id
}

const handleSelectArticle = async (id: number) => {
  selectedArticleId.value = id
  const article = displayedArticles.value.find(a => a.id === id)
  if (article && !article.isRead) {
    await markAsRead(id, true)
  }
}

const handleMarkAllRead = async () => {
  try {
    await markAllAsRead(selectedFeedId.value ?? undefined)
  } catch (error) {
    console.error('Failed to mark all as read:', error)
  }
}

const handleSync = async () => {
  try {
    const result = await syncAll()
    alert(`Synced ${result.summary.total} feeds. ${result.summary.newArticles} new articles.`)
  } catch (error) {
    console.error('Failed to sync:', error)
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
