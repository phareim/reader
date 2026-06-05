<template>
  <div class="space-y-almanac-section-gap font-serif text-ink">
    <input v-model="newFeedUrl" type="url" :placeholder="placeholder"
      :class="['feed-url-input', size === 'large' ? 'is-large' : '']"
      @keyup.enter="handleSmartAdd" />
    <Transition name="fade-scale">
      <div v-if="newFeedUrl.trim() !== ''" class="overflow-hidden">
        <ActionLabel
          :label="loading ? 'PROCESSING' : 'ADD'"
          accent
          :disabled="!newFeedUrl.trim() || loading"
          @click="handleSmartAdd"
        />
      </div>
    </Transition>

    <!-- Discovered Feeds List -->
    <div v-if="discoveredFeeds.length > 0" class="mt-almanac-section-gap">
      <MonoLabel as="h4">
        Found {{ discoveredFeeds.length }} feed{{ discoveredFeeds.length > 1 ? 's' : '' }}
      </MonoLabel>
      <div class="mt-2">
        <button v-for="(feed, index) in discoveredFeeds" :key="index" type="button"
          @click="addDiscoveredFeed(feed.url)"
          :disabled="addingFeed === feed.url"
          class="w-full text-left py-2 border-b border-rule transition-colors hover:text-rust disabled:opacity-50">
          <div class="font-medium text-ink">
            {{ addingFeed === feed.url ? 'Adding…' : feed.title }}
          </div>
          <div class="text-[13px] text-mute truncate">{{ feed.url }}</div>
        </button>
      </div>
    </div>

    <!-- Article Preview -->
    <PaperPanel v-if="detectedArticle" class="mt-almanac-section-gap space-y-almanac-section-gap">
      <div>
        <MonoLabel as="h4">Article Detected</MonoLabel>
        <div class="mt-2 space-y-1">
          <div class="font-medium text-ink">
            {{ detectedArticle.title || 'Untitled' }}
          </div>
          <div v-if="detectedArticle.description" class="text-[13px] text-mute line-clamp-2">
            {{ detectedArticle.description }}
          </div>
          <div v-if="detectedArticle.author" class="text-[13px] text-mute italic">
            By {{ detectedArticle.author }}
          </div>
        </div>
      </div>
      <div class="flex items-center gap-almanac-section-gap">
        <ActionLabel :label="savingArticle ? 'SAVING' : 'SAVE ARTICLE'" accent :disabled="savingArticle" @click="saveArticle" />
        <ActionLabel label="CANCEL" @click="detectedArticle = null" />
      </div>
    </PaperPanel>

    <!-- Unknown / Manual Article Option -->
    <PaperPanel v-if="unknownUrl" class="mt-almanac-section-gap space-y-almanac-section-gap">
      <div>
        <MonoLabel as="h4">No feed found</MonoLabel>
        <p class="mt-2 text-[13px] text-mute">
          Would you like to save this as a manual article?
        </p>
      </div>
      <div class="flex items-center gap-almanac-section-gap">
        <ActionLabel :label="savingArticle ? 'SAVING' : 'SAVE AS ARTICLE'" accent :disabled="savingArticle" @click="saveManualArticle" />
        <ActionLabel label="CANCEL" @click="unknownUrl = null" />
      </div>
    </PaperPanel>
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
/* Hairline-underlined input — no box, no radius, no shadow. */
.feed-url-input {
  width: 100%;
  background: transparent;
  border: 0;
  border-bottom: 1px solid var(--almanac-rule-line);
  color: var(--almanac-fg);
  font-family: var(--almanac-serif, "Source Serif 4", Georgia, serif);
  font-size: 16px;
  line-height: 1.55;
  padding: 6px 0;
  outline: none;
  transition: border-color 0.15s ease;
}
.feed-url-input.is-large {
  font-size: 18px;
  padding: 10px 0;
}
.feed-url-input::placeholder {
  color: var(--almanac-fg-mute);
  opacity: 0.7;
}
.feed-url-input:focus {
  border-bottom-color: var(--almanac-accent);
}

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
