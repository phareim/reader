<template>
  <div class="space-y-3">
    <div class="flex items-center justify-between gap-2">
      <NuxtLink to="/"
        class="font-serif transition-colors"
        :class="$route.path === '/' ? 'text-rust' : 'text-ink hover:text-rust'">
        <MonoLabel>FEEDS</MonoLabel>
      </NuxtLink>
      <label class="flex items-center gap-2 font-serif text-[13px] text-mute cursor-pointer">
        <input v-model="showUnreadOnly" type="checkbox" class="accent-current" />
        <span class="truncate">Unread only</span>
      </label>
    </div>

    <p v-if="feeds.length === 0" class="font-serif text-[14px] italic text-mute">No feeds yet</p>

    <div v-else class="space-y-2">
      <!-- Tag Folders -->
      <div v-for="tag in allTags" :key="tag" v-show="!showUnreadOnly || getTagUnreadCount(tag) > 0">
        <!-- Tag Header (Collapsible) -->
        <div class="flex items-center gap-1 relative">
          <div
            class="flex-1 min-w-0 flex items-center py-1.5 font-serif text-[15px] transition-colors group"
            :class="selectedTag === tag && selectedFeedId === null ? 'text-rust' : 'text-ink'">
            <button @click.stop="toggleTagFolderOnly(tag)"
              class="pr-1.5 py-0.5 text-mute hover:text-ink transition-colors">
              <svg class="w-4 h-4 transition-transform" :class="{ 'rotate-90': openTags.has(tag) }" fill="none"
                stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 5l7 7-7 7" />
              </svg>
            </button>
            <NuxtLink :to="`/tag/${tag}`" class="flex-1 text-left truncate hover:text-rust transition-colors">
              #{{ tag }}
            </NuxtLink>
            <span class="flex-shrink-0 ml-2 mr-2 font-mono text-[11px] text-mute tabular-nums">
              {{ getTagUnreadCount(tag) }}
            </span>
          </div>

          <!-- Tag Dropdown Button -->
          <div class="relative">
            <button @click.stop="toggleTagMenu(tag)"
              class="flex-shrink-0 p-1.5 transition-colors"
              :class="openTagMenuId === tag ? 'text-ink' : 'text-mute hover:text-ink'">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"/>
              </svg>
            </button>

            <!-- Tag Dropdown Menu -->
            <Transition name="dropdown">
              <div v-if="openTagMenuId === tag"
                class="dropdown-menu-container absolute right-0 mt-1 w-48 bg-paper border border-rule z-50">
                <button @click="handleMarkTagAsRead(tag)"
                  class="w-full text-left px-almanac-gutter py-2.5 font-serif text-[14px] text-ink hover:text-rust transition-colors flex items-center gap-2">
                  <svg class="w-4 h-4 text-mute" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
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
          <div v-if="openTags.has(tag)" class="ml-5 space-y-0">
            <div v-for="feed in feedsByTag[tag]" :key="feed.id" class="flex items-center gap-1 relative">
              <NuxtLink :to="`/feed/${feed.id}`"
                class="flex-1 min-w-0 text-left py-1.5 font-serif text-[14px] transition-colors flex items-center"
                :class="$route.path === `/feed/${feed.id}` ? 'text-rust' : 'text-ink hover:text-rust'">
                <img v-if="feed.faviconUrl" :src="feed.faviconUrl" alt="" class="w-4 h-4 flex-shrink-0 mr-2" />
                <span v-else class="w-4 mr-2"></span>
                <span class="flex-1 min-w-0 truncate">{{ feed.title }}</span>
                <span
                  class="flex-shrink-0 ml-2 mr-2 font-mono text-[11px] tabular-nums"
                  :class="feed.unreadCount > 0 ? 'text-mute' : 'opacity-0'">
                  {{ feed.unreadCount > 0 ? feed.unreadCount : '0' }}
                </span>
              </NuxtLink>

              <!-- Dropdown Button -->
              <div class="relative">
                <button @click.stop="toggleFeedMenu(feed.id)"
                  class="flex-shrink-0 p-1.5 transition-colors"
                  :class="openFeedMenuId === feed.id ? 'text-ink' : 'text-mute hover:text-ink'">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"/>
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
        class="border-t border-rule pt-3 mt-3">
        <div
          class="w-full flex items-center py-1.5 font-serif text-[15px] transition-colors group"
          :class="selectedTag === '__inbox__' && selectedFeedId === null ? 'text-rust' : 'text-ink'">
          <button @click.stop="toggleTagFolderOnly('__inbox__')"
            class="pr-1.5 py-0.5 text-mute hover:text-ink transition-colors">
            <svg class="w-4 h-4 transition-transform" :class="{ 'rotate-90': openTags.has('__inbox__') }"
              fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 5l7 7-7 7" />
            </svg>
          </button>
          <NuxtLink to="/tag/__inbox__" class="flex-1 text-left hover:text-rust transition-colors">
            <MonoLabel>INBOX</MonoLabel>
          </NuxtLink>
          <span class="flex-shrink-0 ml-2 mr-2 font-mono text-[11px] text-mute tabular-nums">
            {{ getInboxUnreadCount() }}
          </span>
        </div>

        <!-- Untagged Feeds -->
        <Transition name="expand">
          <div v-if="openTags.has('__inbox__')" class="ml-5 space-y-0">
            <div v-for="feed in feedsByTag['__inbox__']" :key="feed.id" class="flex items-center gap-1 relative">
              <NuxtLink :to="`/feed/${feed.id}`"
                class="flex-1 min-w-0 text-left py-1.5 font-serif text-[14px] transition-colors flex items-center"
                :class="$route.path === `/feed/${feed.id}` ? 'text-rust' : 'text-ink hover:text-rust'">
                <img v-if="feed.faviconUrl" :src="feed.faviconUrl" alt="" class="w-4 h-4 flex-shrink-0 mr-2" />
                <span v-else class="w-4 mr-2"></span>
                <span class="flex-1 min-w-0 truncate">{{ feed.title }}</span>
                <span
                  class="flex-shrink-0 ml-2 mr-2 font-mono text-[11px] tabular-nums"
                  :class="feed.unreadCount > 0 ? 'text-mute' : 'opacity-0'">
                  {{ feed.unreadCount > 0 ? feed.unreadCount : '0' }}
                </span>
              </NuxtLink>

              <!-- Dropdown Button -->
              <div class="relative">
                <button @click.stop="toggleFeedMenu(feed.id)"
                  class="flex-shrink-0 p-1.5 transition-colors"
                  :class="openFeedMenuId === feed.id ? 'text-ink' : 'text-mute hover:text-ink'">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"/>
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
  transform: translateY(-8px);
}

.dropdown-enter-to,
.dropdown-leave-from {
  opacity: 1;
  transform: translateY(0);
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
