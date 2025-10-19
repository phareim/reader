<template>
  <div class="space-y-2">
    <input v-model="newFeedUrl" type="url" :placeholder="placeholder"
      :class="[
        'w-full px-3 border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent',
        size === 'large' ? 'py-3 text-lg' : 'py-2 text-base'
      ]"
      @keyup.enter="handleDiscoverOrAddFeed" />
    <Transition name="fade-scale">
      <div v-if="newFeedUrl.trim() !== ''" class="flex gap-2 items-center justify-between w-full overflow-hidden">
        <button @click="handleDiscoverFeeds" :disabled="!newFeedUrl.trim() || discovering"
          :class="[
            'flex-1 px-3 bg-purple-500 dark:bg-purple-600 text-white rounded-lg hover:bg-purple-600 dark:hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors',
            size === 'large' ? 'py-3 text-lg' : 'py-2 text-base'
          ]">
          {{ discovering ? 'Discovering...' : 'Discover' }}
        </button>
        <button @click="handleAddFeed" :disabled="!newFeedUrl.trim() || loading"
          :class="[
            'flex-1 px-3 bg-blue-500 dark:bg-blue-600 text-white rounded-lg hover:bg-blue-600 dark:hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors',
            size === 'large' ? 'py-3 text-lg' : 'py-2 text-base'
          ]">
          {{ loading ? 'Adding...' : 'Add Direct' }}
        </button>
      </div>
    </Transition>

    <!-- Discovered Feeds List -->
    <div v-if="discoveredFeeds.length > 0"
      class="mt-3 space-y-2 p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
      <h4 :class="['font-semibold text-purple-900 dark:text-purple-300', size === 'large' ? 'text-lg' : 'text-base']">
        Discovered Feeds:
      </h4>
      <div class="space-y-1">
        <button v-for="(feed, index) in discoveredFeeds" :key="index" @click="addDiscoveredFeed(feed.url)"
          :class="[
            'w-full text-left px-3 py-2 bg-white dark:bg-zinc-800 hover:bg-purple-100 dark:hover:bg-purple-900/30 rounded border border-purple-200 dark:border-purple-700 transition-colors',
            size === 'large' ? 'text-lg' : 'text-base'
          ]">
          <div class="font-medium text-purple-900 dark:text-purple-300">{{ feed.title }}</div>
          <div class="text-sm text-purple-600 dark:text-purple-400 truncate">{{ feed.url }}</div>
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
  placeholder: 'Enter URL (feed or website)'
})

const newFeedUrl = ref('')
const loading = ref(false)
const discovering = ref(false)
const discoveredFeeds = ref<Array<{ url: string; title: string; type: string }>>([])

const { addFeed } = useFeeds()
const emit = defineEmits(['success', 'error'])

const handleDiscoverFeeds = async () => {
  if (!newFeedUrl.value.trim()) return

  discovering.value = true
  discoveredFeeds.value = []

  try {
    const response = await $fetch<{ feeds: Array<{ url: string; title: string; type: string }> }>('/api/feeds/discover', {
      method: 'POST',
      body: { url: newFeedUrl.value }
    })

    discoveredFeeds.value = response.feeds
    emit('success', `Found ${response.feeds.length} feed(s)! Click one to add it.`)
  } catch (err: any) {
    emit('error', err.data?.message || err.message || 'Failed to discover feeds')
  } finally {
    discovering.value = false
  }
}

const addDiscoveredFeed = async (feedUrl: string) => {
  loading.value = true

  try {
    await addFeed(feedUrl)
    emit('success', 'Feed added successfully!')
    discoveredFeeds.value = []
    newFeedUrl.value = ''
  } catch (err: any) {
    emit('error', err.data?.message || err.message || 'Failed to add feed')
  } finally {
    loading.value = false
  }
}

const handleAddFeed = async () => {
  if (!newFeedUrl.value.trim()) return

  loading.value = true

  try {
    await addFeed(newFeedUrl.value)
    emit('success', 'Feed added successfully!')
    newFeedUrl.value = ''
    discoveredFeeds.value = []
  } catch (err: any) {
    emit('error', err.data?.message || err.message || 'Failed to add feed')
  } finally {
    loading.value = false
  }
}

const handleDiscoverOrAddFeed = async () => {
  // Try to discover feeds first, if that fails, try adding directly
  await handleDiscoverFeeds()
  if (discoveredFeeds.value.length === 0) {
    await handleAddFeed()
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
