<template>
  <div class="space-y-1">
    <div class="flex items-center gap-1">
      <h3 class="flex-1 font-semibold text-base text-gray-900 dark:text-gray-100 flex items-center gap-2">
        <svg class="w-5 h-5 flex-shrink-0 text-yellow-500 dark:text-yellow-400" fill="currentColor" viewBox="0 0 24 24">
          <path d="M17 3H7c-1.1 0-2 .9-2 2v16l7-3 7 3V5c0-1.1-.9-2-2-2z" />
        </svg>
        <button @click="selectSavedArticles"
          class="flex-1 text-left hover:text-yellow-600 dark:hover:text-yellow-300 transition-colors"
          :class="selectedFeedId === -1 && selectedTag === null ? 'text-yellow-600 dark:text-yellow-300' : ''">
          Saved Articles
        </button>
        <button @click.stop="toggleSavedArticlesFolder"
        class="pl-2 pr-1 py-0.5 hover:bg-gray-200 dark:hover:bg-zinc-700 rounded transition-colors">
        <svg class="w-4 h-4 transition-transform" :class="{ 'rotate-90': isSavedArticlesExpanded }" fill="none"
          stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
        </svg>
      </button>
      </h3>
    </div>

    <!-- Saved Articles Tags -->
    <Transition name="expand">
      <div v-if="isSavedArticlesExpanded && savedArticleTags.length > 0" class="ml-6 space-y-0">
        <div v-for="tag in savedArticleTags" :key="'saved-' + tag" class="space-y-0">
          <!-- Tag Header -->
          <div class="flex items-center gap-1 relative">
            <div class="flex-1 min-w-0 flex items-center py-1.5 text-base font-medium rounded transition-colors group"
              :class="selectedTag === tag && selectedFeedId === -1 ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-900 dark:text-purple-300' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-800'">
              <button @click="$emit('select-saved-tag', tag)" class="flex-1 text-left truncate pl-2 pr-2">
                #{{ tag }}
              </button>
              <span
                class="flex-shrink-0 text-sm bg-purple-500 dark:bg-purple-600 text-white px-2 py-0.5 rounded-full mr-2 min-w-[2rem] text-center">
                {{ getSavedTagCount(tag) }}
              </span>
            </div>

            <!-- Dropdown Button -->
            <div class="relative">
              <button @click.stop="toggleSavedTagMenu(tag)"
                class="flex-shrink-0 p-1.5 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded transition-colors"
                :class="{ 'bg-gray-100 dark:bg-zinc-800': openSavedTagMenuId === tag }">
                <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              <!-- Dropdown Menu (placeholder for future actions) -->
              <Transition name="dropdown">
                <div v-if="openSavedTagMenuId === tag"
                  class="dropdown-menu-container absolute right-0 mt-1 w-64 bg-white dark:bg-zinc-800 rounded-lg shadow-lg border border-gray-200 dark:border-zinc-700 z-50">
                  <div class="px-4 py-2 text-sm text-gray-500 dark:text-gray-400">
                    No actions available yet
                  </div>
                </div>
              </Transition>
            </div>
          </div>
        </div>

        <!-- Untagged Saved Articles -->
        <div v-if="getSavedTagCount('__inbox__') > 0">
          <button @click="$emit('select-saved-tag', '__saved_untagged__')"
            class="w-full flex items-center gap-2 px-2 py-1.5 text-base font-medium rounded transition-colors"
            :class="selectedTag === '__saved_untagged__' && selectedFeedId === -1 ? 'bg-gray-100 dark:bg-zinc-800 text-gray-900 dark:text-gray-100' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-800'">
            <span class="flex-1 text-left">📥 Untagged</span>
            <span class="text-sm bg-gray-500 dark:bg-zinc-700 text-white px-2 py-0.5 rounded-full">
              {{ getSavedTagCount('__inbox__') }}
            </span>
          </button>
        </div>
      </div>
  </Transition>
  </div>
</template>

<script setup lang="ts">
const openSavedTagMenuId = ref<string | null>(null)
const isSavedArticlesExpanded = ref(false)

const { selectedFeedId, selectedTag } = useFeeds()
const { savedArticleTags, getSavedTagCount } = useSavedArticlesByTag()

defineEmits(['select-saved-articles', 'select-saved-tag'])

const selectSavedArticles = () => {
  selectedFeedId.value = -1
  selectedTag.value = null
}

const toggleSavedArticlesFolder = () => {
  isSavedArticlesExpanded.value = !isSavedArticlesExpanded.value
}

const toggleSavedTagMenu = (tag: string) => {
  openSavedTagMenuId.value = openSavedTagMenuId.value === tag ? null : tag
}

// Close dropdowns when clicking outside
onMounted(() => {
  const handleClickOutside = (event: MouseEvent) => {
    const target = event.target as HTMLElement
    const isOutsideDropdowns = !target.closest('.dropdown-menu-container')

    if (isOutsideDropdowns) {
      openSavedTagMenuId.value = null
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
/* Expand transition for collapsible sections */
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
