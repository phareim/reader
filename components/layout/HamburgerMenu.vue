<template>
  <div>
    <!-- Slide-in Menu -->
    <div
      class="fixed top-0 left-0 h-full w-full md:w-80 bg-white dark:bg-zinc-900 shadow-2xl z-30 flex flex-col transition-transform duration-300 ease-in-out"
      :class="isOpen ? 'translate-x-0' : '-translate-x-full'">

      <!-- Menu Header -->
      <MenuHeader @close="isOpen = false" @select-all-feeds="selectAllFeeds" />

      <!-- Scrollable Menu Content -->
      <div class="flex-1 overflow-y-auto p-2 space-y-3">
        <!-- Add Feed Section -->
        <AddFeedSection @success="handleSuccess" @error="handleError" />

        <!-- Success/Error Messages -->
        <p v-if="error" class="text-base text-red-500 dark:text-red-400">{{ error }}</p>
        <p v-if="success" class="text-base text-green-500 dark:text-green-400">{{ success }}</p>

        <!-- Saved Articles -->
        <SavedArticlesSection @select-saved-tag="selectSavedTag" />

        <!-- Feeds List -->
        <FeedsSection @success="handleSuccess" @error="handleError" />
      </div>

      <!-- Bottom Actions -->
      <BottomActions @success="handleSuccess" @error="handleError" />
    </div>
  </div>
</template>

<script setup lang="ts">
import MenuHeader from '~/components/menu/MenuHeader.vue'
import AddFeedSection from '~/components/menu/AddFeedSection.vue'
import SavedArticlesSection from '~/components/menu/SavedArticlesSection.vue'
import FeedsSection from '~/components/menu/FeedsSection.vue'
import BottomActions from '~/components/menu/BottomActions.vue'

const isOpen = ref(false)
const error = ref<string | null>(null)
const success = ref<string | null>(null)

const { selectedFeedId, selectedTag } = useFeeds()
const { data: session } = useAuth()

// Note: Tags and saved articles are fetched in initializeArticlePage()
// No need to duplicate those calls here - they're already in shared state

const selectSavedTag = (tag: string) => {
  selectedFeedId.value = -1
  selectedTag.value = tag
}

const selectAllFeeds = () => {
  // Use -2 as a special value to indicate "overview mode"
  selectedFeedId.value = -2
  selectedTag.value = null
}

// Auto-close menu on mobile when feed/tag selection changes
const isMobile = () => window.innerWidth < 768 // Tailwind md breakpoint

watch([selectedFeedId, selectedTag], () => {
  if (isMobile() && isOpen.value) {
    isOpen.value = false
  }
})

const handleSuccess = (message: string) => {
  error.value = null
  success.value = message
  setTimeout(() => {
    success.value = null
  }, 3000)
}

const handleError = (message: string) => {
  success.value = null
  error.value = message
  setTimeout(() => {
    error.value = null
  }, 3000)
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

