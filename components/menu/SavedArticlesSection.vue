<template>
  <div class="space-y-2">
    <div class="flex items-center justify-between gap-2">
      <NuxtLink
        to="/saved"
        class="font-serif text-[15px] transition-colors"
        :class="$route.path === '/saved' ? 'text-rust' : 'text-ink hover:text-rust'"
      >
        <MonoLabel>SAVED</MonoLabel>
      </NuxtLink>
      <button
        @click.stop="toggleSavedArticlesFolder"
        class="p-1 text-mute hover:text-ink transition-colors"
        aria-label="Toggle saved articles"
      >
        <svg class="w-4 h-4 transition-transform" :class="{ 'rotate-90': isSavedArticlesExpanded }" fill="none"
          stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 5l7 7-7 7" />
        </svg>
      </button>
    </div>

    <!-- Saved Articles Tags -->
    <Transition name="expand">
      <div v-if="isSavedArticlesExpanded && savedArticleTags.length > 0" class="ml-3 space-y-1">
        <div v-for="tag in savedArticleTags" :key="'saved-' + tag">
          <!-- Tag Header -->
          <div class="flex items-center gap-1 relative">
            <button
              @click="$emit('select-saved-tag', tag)"
              class="flex-1 min-w-0 flex items-center justify-between py-1.5 font-serif text-[15px] transition-colors group"
              :class="selectedTag === tag && selectedFeedId === -1 ? 'text-rust' : 'text-ink hover:text-rust'"
            >
              <span class="truncate text-left">#{{ tag }}</span>
              <span class="flex-shrink-0 ml-2 font-mono text-[11px] text-mute tabular-nums">
                {{ getSavedTagCount(tag) }}
              </span>
            </button>

            <!-- Dropdown Button -->
            <div class="relative">
              <button @click.stop="toggleSavedTagMenu(tag)"
                class="flex-shrink-0 p-1.5 transition-colors"
                :class="openSavedTagMenuId === tag ? 'text-ink' : 'text-mute hover:text-ink'">
                <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              <!-- Dropdown Menu (placeholder for future actions) -->
              <Transition name="dropdown">
                <div v-if="openSavedTagMenuId === tag"
                  class="dropdown-menu-container absolute right-0 mt-1 w-56 bg-paper border border-rule z-50 px-almanac-gutter py-3">
                  <p class="font-serif text-[13px] italic text-mute">
                    No actions available yet
                  </p>
                </div>
              </Transition>
            </div>
          </div>
        </div>

        <!-- Untagged Saved Articles -->
        <div v-if="getSavedTagCount('__inbox__') > 0">
          <button @click="$emit('select-saved-tag', '__saved_untagged__')"
            class="w-full flex items-center justify-between py-1.5 font-serif text-[15px] transition-colors"
            :class="selectedTag === '__saved_untagged__' && selectedFeedId === -1 ? 'text-rust' : 'text-ink hover:text-rust'">
            <span class="flex-1 text-left truncate">Untagged</span>
            <span class="flex-shrink-0 ml-2 font-mono text-[11px] text-mute tabular-nums">
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
  transform: translateY(-8px);
}

.dropdown-enter-to,
.dropdown-leave-from {
  opacity: 1;
  transform: translateY(0);
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
