<template>
  <div class="space-y-2">
    <input v-model="newFeedUrl" type="url" :placeholder="placeholder"
      :class="[
        'w-full px-3 border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent',
        size === 'large' ? 'py-3 text-lg' : 'py-2 text-base'
      ]"
      @keyup.enter="handleSmartAdd" />
    <Transition name="fade-scale">
      <div v-if="newFeedUrl.trim() !== ''" class="flex gap-2 items-center justify-between w-full overflow-hidden">
        <button @click="handleSmartAdd" :disabled="!newFeedUrl.trim() || loading"
          :class="[
            'flex-1 px-3 bg-blue-500 dark:bg-blue-600 text-white rounded-lg hover:bg-blue-600 dark:hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors',
            size === 'large' ? 'py-3 text-lg' : 'py-2 text-base'
          ]">
          {{ loading ? 'Processing...' : 'Add' }}
        </button>
      </div>
    </Transition>

    <!-- Discovered Feeds List -->
    <div v-if="discoveredFeeds.length > 0"
      class="mt-3 space-y-2 p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
      <h4 :class="['font-semibold text-purple-900 dark:text-purple-300', size === 'large' ? 'text-lg' : 'text-base']">
        Found {{ discoveredFeeds.length }} feed{{ discoveredFeeds.length > 1 ? 's' : '' }}:
      </h4>
      <div class="space-y-1">
        <button v-for="(feed, index) in discoveredFeeds" :key="index" @click="addDiscoveredFeed(feed.url)"
          :disabled="addingFeed === feed.url"
          :class="[
            'w-full text-left px-3 py-2 bg-white dark:bg-zinc-800 hover:bg-purple-100 dark:hover:bg-purple-900/30 rounded border border-purple-200 dark:border-purple-700 transition-colors disabled:opacity-50',
            size === 'large' ? 'text-lg' : 'text-base'
          ]">
          <div class="font-medium text-purple-900 dark:text-purple-300">
            {{ addingFeed === feed.url ? 'Adding...' : feed.title }}
          </div>
          <div class="text-sm text-purple-600 dark:text-purple-400 truncate">{{ feed.url }}</div>
        </button>
      </div>
    </div>

    <!-- Article Preview -->
    <div v-if="detectedArticle"
      class="mt-3 space-y-3 p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-700">
      <div>
        <h4 :class="['font-semibold text-amber-900 dark:text-amber-300 mb-2', size === 'large' ? 'text-lg' : 'text-base']">
          Article Detected
        </h4>
        <div class="space-y-2">
          <div class="font-medium text-gray-900 dark:text-gray-100">
            {{ detectedArticle.title || 'Untitled' }}
          </div>
          <div v-if="detectedArticle.description" class="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
            {{ detectedArticle.description }}
          </div>
          <div v-if="detectedArticle.author" class="text-sm text-gray-500 dark:text-gray-500">
            By {{ detectedArticle.author }}
          </div>
        </div>
      </div>
      <div class="flex gap-2">
        <button @click="saveArticle" :disabled="savingArticle"
          :class="[
            'flex-1 px-3 py-2 bg-amber-600 dark:bg-amber-700 text-white rounded-lg hover:bg-amber-700 dark:hover:bg-amber-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors',
            size === 'large' ? 'text-lg' : 'text-base'
          ]">
          {{ savingArticle ? 'Saving...' : 'Save Article' }}
        </button>
        <button @click="detectedArticle = null"
          :class="[
            'px-3 py-2 bg-gray-200 dark:bg-zinc-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-zinc-600 transition-colors',
            size === 'large' ? 'text-lg' : 'text-base'
          ]">
          Cancel
        </button>
      </div>
    </div>

    <!-- Unknown / Manual Article Option -->
    <div v-if="unknownUrl"
      class="mt-3 space-y-3 p-4 bg-gray-50 dark:bg-zinc-800/50 rounded-lg border border-gray-200 dark:border-zinc-700">
      <div>
        <h4 :class="['font-semibold text-gray-900 dark:text-gray-300 mb-2', size === 'large' ? 'text-lg' : 'text-base']">
          No feed found
        </h4>
        <p class="text-sm text-gray-600 dark:text-gray-400">
          Would you like to save this as a manual article?
        </p>
      </div>
      <div class="flex gap-2">
        <button @click="saveManualArticle" :disabled="savingArticle"
          :class="[
            'flex-1 px-3 py-2 bg-blue-600 dark:bg-blue-700 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors',
            size === 'large' ? 'text-lg' : 'text-base'
          ]">
          {{ savingArticle ? 'Saving...' : 'Save as Article' }}
        </button>
        <button @click="unknownUrl = null"
          :class="[
            'px-3 py-2 bg-gray-200 dark:bg-zinc-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-zinc-600 transition-colors',
            size === 'large' ? 'text-lg' : 'text-base'
          ]">
          Cancel
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
interface Props {
  size?: 'normal' | 'large'
  placeholder?: string
}

withDefaults(defineProps<Props>(), {
  size: 'normal',
  placeholder: 'Enter feed URL, website, or article'
})

interface DiscoveredFeed {
  url: string
  title: string
  type: string
}

interface DetectedArticle {
  title?: string
  url: string
  description?: string
  author?: string
  content?: string
  publishedAt?: string
  imageUrl?: string
}

interface UnknownUrl {
  title: string
  url: string
}

const newFeedUrl = ref('')
const loading = ref(false)
const addingFeed = ref<string | null>(null)
const savingArticle = ref(false)
const discoveredFeeds = ref<DiscoveredFeed[]>([])
const detectedArticle = ref<DetectedArticle | null>(null)
const unknownUrl = ref<UnknownUrl | null>(null)

const { fetchFeeds, selectedFeedId } = useFeeds()
const emit = defineEmits(['success', 'error'])

// Reset all states
const resetStates = () => {
  discoveredFeeds.value = []
  detectedArticle.value = null
  unknownUrl.value = null
}

// Main smart add handler
const handleSmartAdd = async () => {
  if (!newFeedUrl.value.trim()) return

  loading.value = true
  resetStates()

  try {
    const response = await $fetch<any>('/api/feeds/add-smart', {
      method: 'POST',
      body: { url: newFeedUrl.value }
    })

    switch (response.type) {
      case 'feed_added':
        // Feed was added successfully
        await fetchFeeds()

        // Optionally select the newly added feed
        if (response.feed?.id) {
          selectedFeedId.value = response.feed.id
        }

        // Clear input and loading state before emitting success
        loading.value = false
        newFeedUrl.value = ''
        await nextTick() // Ensure DOM updates

        emit('success', response.message || 'Feed added successfully!')
        return // Exit early to skip the finally block

      case 'feed_exists':
        // Feed already exists
        loading.value = false
        newFeedUrl.value = ''
        await nextTick()

        emit('error', response.message || 'This feed is already in your list')
        return

      case 'feeds_discovered':
        // Multiple feeds found - show options
        discoveredFeeds.value = response.feeds
        emit('success', response.message || `Found ${response.feeds.length} feed(s)! Click one to add it.`)
        break

      case 'article_detected':
        // Article detected - show preview
        detectedArticle.value = response.article
        break

      case 'unknown':
        // Unknown content - offer manual article option
        unknownUrl.value = response.suggestion
        break

      default:
        emit('error', 'Unexpected response from server')
    }
  } catch (err: any) {
    emit('error', err.data?.message || err.message || 'Failed to process URL')
  } finally {
    loading.value = false
  }
}

// Add a discovered feed
const addDiscoveredFeed = async (feedUrl: string) => {
  addingFeed.value = feedUrl

  try {
    const response = await $fetch<any>('/api/feeds', {
      method: 'POST',
      body: { url: feedUrl }
    })

    await fetchFeeds()

    // Select the newly added feed
    if (response.feed?.id) {
      selectedFeedId.value = response.feed.id
    }

    // Clear states
    addingFeed.value = null
    discoveredFeeds.value = []
    newFeedUrl.value = ''
    await nextTick()

    emit('success', 'Feed added successfully!')
  } catch (err: any) {
    addingFeed.value = null
    emit('error', err.data?.message || err.message || 'Failed to add feed')
  }
}

// Save detected article
const saveArticle = async () => {
  if (!detectedArticle.value) return

  savingArticle.value = true

  try {
    await $fetch('/api/articles/manual', {
      method: 'POST',
      body: {
        title: detectedArticle.value.title || 'Untitled',
        url: detectedArticle.value.url,
        content: detectedArticle.value.content,
        summary: detectedArticle.value.description,
        author: detectedArticle.value.author
      }
    })

    // Clear states
    savingArticle.value = false
    detectedArticle.value = null
    newFeedUrl.value = ''
    await nextTick()

    emit('success', 'Article saved successfully!')
  } catch (err: any) {
    savingArticle.value = false
    emit('error', err.data?.message || err.message || 'Failed to save article')
  }
}

// Save manual article (from unknown URL)
const saveManualArticle = async () => {
  if (!unknownUrl.value) return

  savingArticle.value = true

  try {
    await $fetch('/api/articles/manual', {
      method: 'POST',
      body: {
        title: unknownUrl.value.title,
        url: unknownUrl.value.url
      }
    })

    // Clear states
    savingArticle.value = false
    unknownUrl.value = null
    newFeedUrl.value = ''
    await nextTick()

    emit('success', 'Article saved successfully!')
  } catch (err: any) {
    savingArticle.value = false
    emit('error', err.data?.message || err.message || 'Failed to save article')
  }
}
</script>

<style scoped>
/* Smooth show/hide for the discover/add buttons */
.fade-scale-enter-active,
.fade-scale-leave-active {
  transition: opacity 400ms ease, transform 300ms ease, max-height 300ms ease;
}

.fade-scale-enter-from,
.fade-scale-leave-to {
  opacity: 0;
  transform: translateY(-6px) scale(0.5);
  max-height: 0;
}

.fade-scale-enter-to,
.fade-scale-leave-from {
  opacity: 1;
  transform: translateY(0) scale(1);
  max-height: 120px;
}
</style>
