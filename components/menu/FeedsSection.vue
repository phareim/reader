<template>
  <div class="space-y-3">
    <h3 class="font-semibold text-base text-gray-900 dark:text-gray-100 flex items-center justify-between gap-2">
      <div class="flex items-center gap-2">
        <svg class="w-5 h-5 flex-shrink-0 text-blue-500 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 5c7.18 0 13 5.82 13 13M6 11a7 7 0 017 7m-6 0a1 1 0 11-2 0 1 1 0 012 0z" />
        </svg>
        <button @click="selectAllFeeds"
          class="hover:text-blue-600 dark:hover:text-blue-300 transition-colors"
          :class="selectedFeedId === -2 && selectedTag === null ? 'text-blue-600 dark:text-blue-300' : ''">
          Feeds
        </button>
      </div>
      <label class="flex items-center gap-2 text-base font-normal text-gray-700 dark:text-gray-300">
        <input v-model="showUnreadOnly" type="checkbox" />
        <span class="truncate">Unread only</span>
      </label>
    </h3>

    <div v-if="feeds.length === 0" class="text-base text-gray-500 dark:text-gray-400">No feeds yet</div>

    <div v-else class="space-y-1">
      <!-- Tag Folders -->
      <div v-for="tag in allTags" :key="tag" v-show="!showUnreadOnly || getTagUnreadCount(tag) > 0"
        class="space-y-0">
        <!-- Tag Header (Collapsible) -->
        <div class="flex items-center gap-1 relative">
          <div
            class="flex-1 min-w-0 flex items-center py-1.5 text-base font-medium rounded transition-colors group"
            :class="selectedTag === tag && selectedFeedId === null ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-900 dark:text-purple-300' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-800'">
            <button @click.stop="toggleTagFolderOnly(tag)"
              class="pl-2 pr-1 py-0.5 hover:bg-gray-200 dark:hover:bg-zinc-700 rounded transition-colors">
              <svg class="w-4 h-4 transition-transform" :class="{ 'rotate-90': openTags.has(tag) }" fill="none"
                stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
              </svg>
            </button>
            <button @click="selectTag(tag)" class="flex-1 text-left pl-1 pr-2">
              #{{ tag }}
            </button>
            <span class="flex-shrink-0 text-sm bg-purple-500 dark:bg-purple-600 text-white px-2 py-0.5 rounded-full mr-2 min-w-[2rem] text-center">
              {{ getTagUnreadCount(tag) }}
            </span>
          </div>

          <!-- Tag Dropdown Button -->
          <div class="relative">
            <button @click.stop="toggleTagMenu(tag)"
              class="flex-shrink-0 p-1.5 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded transition-colors"
              :class="{ 'bg-gray-100 dark:bg-zinc-800': openTagMenuId === tag }">
              <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            <!-- Tag Dropdown Menu -->
            <Transition name="dropdown">
              <div v-if="openTagMenuId === tag"
                class="dropdown-menu-container absolute right-0 mt-1 w-48 bg-white dark:bg-zinc-800 rounded-lg shadow-lg border border-gray-200 dark:border-zinc-700 z-50">
                <button @click="handleMarkTagAsRead(tag)"
                  class="w-full text-left px-4 py-2 text-base text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-700 rounded-lg transition-colors flex items-center gap-2">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>Mark all as read</span>
                </button>
              </div>
            </Transition>
          </div>
        </div>

        <!-- Feeds under this tag -->
        <Transition name="expand">
          <div v-if="openTags.has(tag)" class="ml-4 space-y-0">
            <div v-for="feed in feedsByTag[tag]" :key="feed.id" class="flex items-center gap-1 relative">
              <button @click="selectFeed(feed.id, tag)"
                class="flex-1 min-w-0 text-left py-1.5 text-base rounded transition-colors flex items-center"
                :class="selectedFeedId === feed.id ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-900 dark:text-blue-300' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-800'">
                <img v-if="feed.faviconUrl" :src="feed.faviconUrl" alt="" class="w-4 h-4 flex-shrink-0 ml-3 mr-2" />
                <span v-else class="w-4 ml-3 mr-2"></span>
                <span class="flex-1 min-w-0 truncate">{{ feed.title }}</span>
                <span
                  class="flex-shrink-0 text-sm text-white px-2 py-0.5 rounded-full mr-2 min-w-[2rem] text-center"
                  :class="feed.unreadCount > 0 ? 'bg-blue-500 dark:bg-blue-600' : 'opacity-0'">
                  {{ feed.unreadCount > 0 ? feed.unreadCount : '0' }}
                </span>
              </button>

              <!-- Dropdown Button -->
              <div class="relative">
                <button @click.stop="toggleFeedMenu(feed.id)"
                  class="flex-shrink-0 p-1.5 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded transition-colors"
                  :class="{ 'bg-gray-100 dark:bg-zinc-800': openFeedMenuId === feed.id }">
                  <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                <!-- Dropdown Menu -->
                <Transition name="dropdown">
                  <div v-if="openFeedMenuId === feed.id">
                    <FeedDropdownMenu
                      :feed="feed"
                      :all-tags="allTagsWithCounts"
                      @mark-as-read="handleMarkFeedAsRead(feed.id)"
                      @add-tag="(tag) => handleAddTag(feed.id, tag)"
                      @remove-tag="(tag) => handleRemoveTag(feed.id, tag)"
                      @delete-feed="handleDeleteFeed(feed.id, feed.title)"
                    />
                  </div>
                </Transition>
              </div>
            </div>
          </div>
        </Transition>
      </div>

      <!-- Inbox Section (Untagged Feeds) -->
      <div v-if="feedsByTag['__inbox__'] && feedsByTag['__inbox__'].length > 0"
        v-show="!showUnreadOnly || getInboxUnreadCount() > 0"
        class="space-y-0 border-t border-gray-200 dark:border-zinc-800 pt-2 mt-2">
        <div
          class="w-full flex items-center py-1.5 text-base font-medium rounded transition-colors group"
          :class="selectedTag === '__inbox__' && selectedFeedId === null ? 'bg-gray-100 dark:bg-zinc-800 text-gray-900 dark:text-gray-100' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-800'">
          <button @click.stop="toggleTagFolderOnly('__inbox__')"
            class="pl-2 pr-1 py-0.5 hover:bg-gray-200 dark:hover:bg-zinc-700 rounded transition-colors">
            <svg class="w-4 h-4 transition-transform" :class="{ 'rotate-90': openTags.has('__inbox__') }"
              fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
            </svg>
          </button>
          <button @click="selectTag('__inbox__')" class="flex-1 text-left pl-1 pr-2">
            📥 Inbox
          </button>
          <span class="flex-shrink-0 text-sm bg-gray-500 dark:bg-zinc-700 text-white px-2 py-0.5 rounded-full mr-2 min-w-[2rem] text-center">
            {{ getInboxUnreadCount() }}
          </span>
        </div>

        <!-- Untagged Feeds -->
        <Transition name="expand">
          <div v-if="openTags.has('__inbox__')" class="ml-4 space-y-0">
            <div v-for="feed in feedsByTag['__inbox__']" :key="feed.id" class="flex items-center gap-1 relative">
              <button @click="selectFeed(feed.id, '__inbox__')"
                class="flex-1 min-w-0 text-left py-1.5 text-base rounded transition-colors flex items-center"
                :class="selectedFeedId === feed.id ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-900 dark:text-blue-300' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-800'">
                <img v-if="feed.faviconUrl" :src="feed.faviconUrl" alt="" class="w-4 h-4 flex-shrink-0 ml-3 mr-2" />
                <span v-else class="w-4 ml-3 mr-2"></span>
                <span class="flex-1 min-w-0 truncate">{{ feed.title }}</span>
                <span
                  class="flex-shrink-0 text-sm text-white px-2 py-0.5 rounded-full mr-2 min-w-[2rem] text-center"
                  :class="feed.unreadCount > 0 ? 'bg-blue-500 dark:bg-blue-600' : 'opacity-0'">
                  {{ feed.unreadCount > 0 ? feed.unreadCount : '0' }}
                </span>
              </button>

              <!-- Dropdown Button -->
              <div class="relative">
                <button @click.stop="toggleFeedMenu(feed.id)"
                  class="flex-shrink-0 p-1.5 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded transition-colors"
                  :class="{ 'bg-gray-100 dark:bg-zinc-800': openFeedMenuId === feed.id }">
                  <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                <!-- Dropdown Menu (Same as above) -->
                <Transition name="dropdown">
                  <div v-if="openFeedMenuId === feed.id">
                    <FeedDropdownMenu
                      :feed="feed"
                      :all-tags="allTagsWithCounts"
                      @mark-as-read="handleMarkFeedAsRead(feed.id)"
                      @add-tag="(tag) => handleAddTag(feed.id, tag)"
                      @remove-tag="(tag) => handleRemoveTag(feed.id, tag)"
                      @delete-feed="handleDeleteFeed(feed.id, feed.title)"
                    />
                  </div>
                </Transition>
              </div>
            </div>
          </div>
        </Transition>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import FeedDropdownMenu from '~/components/menu/FeedDropdownMenu.vue'

const openFeedMenuId = ref<number | null>(null)
const openTagMenuId = ref<string | null>(null)
const openTags = ref<Set<string>>(new Set())

const { feeds, selectedFeedId, selectedTag, allTags, feedsByTag, deleteFeed, updateFeedTags } = useFeeds()
const { showUnreadOnly, markAllAsRead } = useArticles()
const { tags, fetchTags } = useTags()

const emit = defineEmits(['success', 'error'])

// Computed property to provide tags with counts for autocomplete
const allTagsWithCounts = computed(() => tags.value || [])

const toggleTagFolderOnly = (tag: string) => {
  if (openTags.value.has(tag)) {
    openTags.value.delete(tag)
  } else {
    openTags.value.add(tag)
  }
}

const selectTag = (tag: string) => {
  selectedTag.value = tag
  selectedFeedId.value = null
  // Open the tag folder when selecting it
  if (!openTags.value.has(tag)) {
    openTags.value.add(tag)
  }
}

const selectFeed = (feedId: number, tag?: string) => {
  selectedFeedId.value = feedId
  selectedTag.value = tag || null
  // Open the tag folder if provided
  if (tag && !openTags.value.has(tag)) {
    openTags.value.add(tag)
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

const selectAllFeeds = () => {
  // Use -2 as a special value to indicate "overview mode"
  selectedFeedId.value = -2
  selectedTag.value = null
}

const toggleFeedMenu = (feedId: number) => {
  openFeedMenuId.value = openFeedMenuId.value === feedId ? null : feedId
}

const toggleTagMenu = (tag: string) => {
  openTagMenuId.value = openTagMenuId.value === tag ? null : tag
}

const handleMarkFeedAsRead = async (feedId: number) => {
  openFeedMenuId.value = null

  try {
    await markAllAsRead(feedId)
    emit('success', 'All articles marked as read!')
  } catch (err: any) {
    emit('error', 'Failed to mark all as read')
  }
}

const handleMarkTagAsRead = async (tag: string) => {
  openTagMenuId.value = null

  try {
    // Get all feeds with this tag
    const tagFeeds = feedsByTag.value[tag] || []

    // Mark all articles in all feeds with this tag as read
    for (const feed of tagFeeds) {
      await markAllAsRead(feed.id)
    }

    emit('success', `All articles in #${tag} marked as read!`)
  } catch (err: any) {
    emit('error', 'Failed to mark tag as read')
  }
}

const handleDeleteFeed = async (feedId: number, feedTitle: string) => {
  openFeedMenuId.value = null

  if (!confirm(`Are you sure you want to delete "${feedTitle}"?\n\nThis will also delete all articles from this feed.`)) {
    return
  }

  try {
    await deleteFeed(feedId)
    emit('success', 'Feed deleted successfully!')
  } catch (err: any) {
    emit('error', err.data?.message || err.message || 'Failed to delete feed')
  }
}

const handleAddTag = async (feedId: number, tag: string) => {
  const cleanTag = tag.trim().replace(/^#/, '') // Remove leading # if present
  if (!cleanTag) return

  const feed = feeds.value.find(f => f.id === feedId)
  if (!feed) return

  // Check if tag already exists
  if (feed.tags.includes(cleanTag)) {
    emit('error', 'Tag already exists')
    return
  }

  try {
    await updateFeedTags(feedId, [...feed.tags, cleanTag])
    emit('success', 'Tag added!')

    // Refresh tags list to update counts for autocomplete
    await fetchTags()
  } catch (err: any) {
    emit('error', err.data?.message || err.message || 'Failed to add tag')
  }
}

const handleRemoveTag = async (feedId: number, tagToRemove: string) => {
  const feed = feeds.value.find(f => f.id === feedId)
  if (!feed) return

  try {
    await updateFeedTags(feedId, feed.tags.filter(t => t !== tagToRemove))
    emit('success', 'Tag removed!')
  } catch (err: any) {
    emit('error', err.data?.message || err.message || 'Failed to remove tag')
  }
}

// Close dropdowns when clicking outside
onMounted(() => {
  const handleClickOutside = (event: MouseEvent) => {
    const target = event.target as HTMLElement

    // Check if click is outside any dropdown
    const isOutsideDropdowns = !target.closest('.dropdown-menu-container')

    if (isOutsideDropdowns) {
      openFeedMenuId.value = null
      openTagMenuId.value = null
    }
  }

  document.addEventListener('mousedown', handleClickOutside)

  onUnmounted(() => {
    document.removeEventListener('mousedown', handleClickOutside)
  })
})
</script>

<style scoped>
/* Dropdown transition */
.dropdown-enter-active,
.dropdown-leave-active {
  transition: opacity 150ms ease, transform 150ms ease;
}

.dropdown-enter-from,
.dropdown-leave-to {
  opacity: 0;
  transform: translateY(-8px) scale(0.95);
}

.dropdown-enter-to,
.dropdown-leave-from {
  opacity: 1;
  transform: translateY(0) scale(1);
}

/* Expand transition for tag folders */
.expand-enter-active,
.expand-leave-active {
  transition: all 200ms ease;
  overflow: hidden;
}

.expand-enter-from,
.expand-leave-to {
  opacity: 0;
  max-height: 0;
}

.expand-enter-to,
.expand-leave-from {
  opacity: 1;
  max-height: 1000px;
}
</style>
