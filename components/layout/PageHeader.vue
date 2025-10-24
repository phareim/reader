<template>
  <div class="sticky top-0 z-20 bg-white h-16 dark:bg-zinc-900 border-b dark:border-zinc-800 px-6 py-4 flex items-center justify-between">
    <div class="flex items-center gap-1 flex-1 min-w-0">
      <!-- Hamburger Button -->
      <button
        v-if="!menuIsOpen"
        @click="$emit('toggle-menu')"
        class="p-2 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg transition-colors text-gray-900 dark:text-gray-100 flex-shrink-0"
        aria-label="Toggle menu"
      >
        <svg class="w-6 h-6" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path fill="currentColor" fill-rule="evenodd" d="M4.167 3C3.522 3 3 3.522 3 4.167v11.666C3 16.478 3.522 17 4.167 17H7V3zM8 3v14h7.833c.645 0 1.167-.522 1.167-1.167V4.167C17 3.522 16.478 3 15.833 3zM2 4.167C2 2.97 2.97 2 4.167 2h11.666C17.03 2 18 2.97 18 4.167v11.666C18 17.03 17.03 18 15.833 18H4.167A2.167 2.167 0 0 1 2 15.833z" clip-rule="evenodd" />
        </svg>
      </button>

      <!-- Dynamic Title -->
      <h1 class="text-xl font-bold flex items-center gap-3 text-gray-900 dark:text-gray-100 min-w-0 flex-1">
        <Transition name="fade-title" mode="out-in">
          <!-- Show current article title when scrolled -->
          <div v-if="currentArticle" class="flex items-center gap-1 min-w-0 flex-1" :key="'article-' + currentArticle.id">
            <span class="truncate">
              <img
                v-if="selectedFeed && selectedFeed.faviconUrl"
                :src="selectedFeed.faviconUrl"
                :alt="selectedFeed.title"
                class="w-8 h-8 inline-block"
              />
              <span v-else-if="selectedFeedId === -1">
                <svg class="w-7 h-7 text-yellow-500 dark:text-yellow-400 flex-shrink-0 inline-block" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M17 3H7c-1.1 0-2 .9-2 2v16l7-3 7 3V5c0-1.1-.9-2-2-2z"/>
                </svg>
              </span>
              <span v-else-if="selectedTag" class="pl-2 text-gray-500 dark:text-gray-400">#{{ selectedTag }}</span>
              <span class="truncate pl-2">{{ currentArticle.title }}</span>
              <span class="truncate pl-2 text-gray-500 dark:text-gray-400 text-sm" v-if="selectedFeed">• {{ selectedFeed.title }}</span>
            </span>
          </div>
          <!-- Show default context title -->
          <div v-else class="flex items-center gap-3 min-w-0 flex-1" key="default">
            <template v-if="selectedFeedId === -1">
              <svg class="w-7 h-7 text-yellow-500 dark:text-yellow-400 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                <path d="M17 3H7c-1.1 0-2 .9-2 2v16l7-3 7 3V5c0-1.1-.9-2-2-2z"/>
              </svg>
              <span class="truncate">Saved Articles</span>
            </template>
            <template v-else-if="selectedFeed">
              <img
                v-if="selectedFeed.faviconUrl"
                :src="selectedFeed.faviconUrl"
                :alt="selectedFeed.title"
                class="w-8 h-8 flex-shrink-0"
              />
              <span class="truncate">{{ selectedFeed.title }}</span>
            </template>
            <template v-else-if="selectedTag">
              <span v-if="selectedTag === '__inbox__'" class="truncate">📥 Inbox</span>
              <span v-else class="truncate">#{{ selectedTag }}</span>
            </template>
            <span v-else class="truncate">All Vibes — The RSS Reader</span>
          </div>
        </Transition>
      </h1>
    </div>
  </div>
</template>

<script setup lang="ts">
interface Article {
  id: number
  title: string
}

interface Feed {
  id: number
  title: string
  faviconUrl?: string
}

interface Props {
  menuIsOpen: boolean
  currentArticle: Article | null
  selectedFeed?: Feed | null
  selectedFeedId: number | null
  selectedTag: string | null
}

withDefaults(defineProps<Props>(), {
  selectedFeed: null
})

defineEmits<{
  'toggle-menu': []
}>()
</script>

<style scoped>
/* Smooth fade transition for sticky header title */
.fade-title-enter-active,
.fade-title-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.fade-title-enter-from {
  opacity: 0;
  transform: translateY(-4px);
}

.fade-title-leave-to {
  opacity: 0;
  transform: translateY(4px);
}

.fade-title-enter-to,
.fade-title-leave-from {
  opacity: 1;
  transform: translateY(0);
}
</style>
