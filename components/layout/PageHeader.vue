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
      <h1 class="text-xl font-bold flex items-center gap-3 text-gray-900 dark:text-gray-100 min-w-0 flex-1 mr-3">
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
              <span v-if="totalCount > 0" class="text-sm text-gray-500 dark:text-gray-400 flex-shrink-0">
                ({{ totalCount }})
              </span>
            </template>
            <template v-else-if="selectedFeed">
              <img
                v-if="selectedFeed.faviconUrl"
                :src="selectedFeed.faviconUrl"
                :alt="selectedFeed.title"
                class="w-8 h-8 flex-shrink-0"
              />
              <span class="truncate">{{ selectedFeed.title }}</span>
              <span v-if="unreadCount > 0" class="text-sm text-gray-500 dark:text-gray-400 flex-shrink-0">
                ({{ unreadCount }} unread)
              </span>
            </template>
            <template v-else-if="selectedTag">
              <span v-if="selectedTag === '__inbox__'" class="truncate">📥 Inbox</span>
              <span v-else class="truncate">#{{ selectedTag }}</span>
              <span v-if="unreadCount > 0" class="text-sm text-gray-500 dark:text-gray-400 flex-shrink-0">
                ({{ unreadCount }} unread)
              </span>
            </template>
            <span v-else class="truncate">The Librarian</span>
          </div>
        </Transition>
      </h1>
    </div>

    <!-- Header Actions Menu -->
    <div class="relative flex-shrink-0">
      <button
        ref="menuButtonRef"
        @click.stop="toggleMenu"
        class="p-2 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg transition-colors flex-shrink-0"
        :class="showMenu ? 'bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-gray-300' : 'text-gray-400 dark:text-gray-500'"
        :title="'Actions'"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"/>
        </svg>
      </button>

      <!-- Actions Dropdown -->
      <Transition name="dropdown">
        <div
          v-if="showMenu"
          ref="menuRef"
        >
          <PageHeaderMenu
            :selected-feed-id="selectedFeedId"
            :is-refreshing="isRefreshing"
            @sign-out="$emit('sign-out')"
            @refresh-feed="$emit('refresh-feed')"
            @success="$emit('success', $event)"
            @error="$emit('error', $event)"
          />
        </div>
      </Transition>
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
  isRefreshing?: boolean
  unreadCount?: number
  totalCount?: number
}

withDefaults(defineProps<Props>(), {
  selectedFeed: null,
  isRefreshing: false,
  unreadCount: 0,
  totalCount: 0
})

defineEmits<{
  'toggle-menu': []
  'mark-all-read': []
  'refresh-feed': []
  'sync-all': []
  'view-saved': []
  'sign-out': []
  'success': [message: string]
  'error': [message: string]
}>()

const showMenu = ref(false)
const menuRef = ref<HTMLElement | null>(null)
const menuButtonRef = ref<HTMLElement | null>(null)

// Close dropdown when clicking outside
onMounted(() => {
  const handleClickOutside = (event: MouseEvent) => {
    if (!showMenu.value) return

    const target = event.target as HTMLElement

    // Check if click is outside both the menu and the toggle button
    const isOutsideMenu = menuRef.value && !menuRef.value.contains(target)
    const isOutsideButton = menuButtonRef.value && !menuButtonRef.value.contains(target)

    if (isOutsideMenu && isOutsideButton) {
      showMenu.value = false
    }
  }

  document.addEventListener('mousedown', handleClickOutside)

  onUnmounted(() => {
    document.removeEventListener('mousedown', handleClickOutside)
  })
})

const toggleMenu = () => {
  showMenu.value = !showMenu.value
}
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

/* Dropdown transition */
.dropdown-enter-active,
.dropdown-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.dropdown-enter-from,
.dropdown-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

.dropdown-enter-to,
.dropdown-leave-from {
  opacity: 1;
  transform: translateY(0);
}
</style>
