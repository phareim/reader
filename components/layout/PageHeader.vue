<template>
  <div class="sticky top-0 z-20 bg-paper border-b border-rule px-almanac-gutter h-16 flex items-center justify-between">
    <div class="flex items-center gap-3 flex-1 min-w-0">
      <!-- Hamburger Button -->
      <button
        v-if="!menuIsOpen"
        @click="$emit('toggle-menu')"
        class="p-2 -ml-2 text-ink/70 hover:text-ink transition-colors flex-shrink-0"
        aria-label="Toggle menu"
      >
        <svg class="w-6 h-6" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path fill="currentColor" fill-rule="evenodd" d="M4.167 3C3.522 3 3 3.522 3 4.167v11.666C3 16.478 3.522 17 4.167 17H7V3zM8 3v14h7.833c.645 0 1.167-.522 1.167-1.167V4.167C17 3.522 16.478 3 15.833 3zM2 4.167C2 2.97 2.97 2 4.167 2h11.666C17.03 2 18 2.97 18 4.167v11.666C18 17.03 17.03 18 15.833 18H4.167A2.167 2.167 0 0 1 2 15.833z" clip-rule="evenodd" />
        </svg>
      </button>

      <!-- Dynamic Context -->
      <div class="flex items-center gap-3 min-w-0 flex-1 mr-3">
        <Transition name="fade-title" mode="out-in">
          <!-- Show current article title when scrolled -->
          <div v-if="currentArticle" class="flex items-baseline gap-2 min-w-0 flex-1" :key="'article-' + currentArticle.id">
            <MonoLabel class="flex-shrink-0">{{ contextLabel }}</MonoLabel>
            <SerifHeadline level="h3" class="truncate min-w-0">{{ currentArticle.title }}</SerifHeadline>
          </div>
          <!-- Show default context -->
          <div v-else class="flex items-baseline gap-2 min-w-0 flex-1" key="default">
            <MonoLabel class="flex-shrink-0">{{ contextLabel }}</MonoLabel>
            <span v-if="contextSubtitle" class="font-serif text-[13px] text-mute truncate min-w-0">
              {{ contextSubtitle }}
            </span>
            <span v-if="unreadCount > 0 || totalCount > 0" class="flex-shrink-0 font-mono text-[11px] text-mute tabular-nums">
              {{ countLabel }}
            </span>
          </div>
        </Transition>

        <!-- Loading Indicator -->
        <Transition name="fade">
          <div v-if="isLoading" class="flex-shrink-0" title="Loading...">
            <svg class="animate-spin h-4 w-4 text-mute" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
        </Transition>
      </div>
    </div>

    <!-- Search Input -->
    <Transition name="search">
      <div v-if="showSearchInput && showSearch" class="flex items-center gap-2 mx-4 flex-shrink-0">
        <div class="relative">
          <input
            ref="searchInputRef"
            v-model="searchQuery"
            type="text"
            placeholder="Search articles…"
            class="w-64 pl-8 pr-7 py-1.5 font-serif text-[14px] bg-transparent text-ink placeholder-mute border-0 border-b border-rule focus:outline-none focus:border-ink transition-colors"
            @keydown.esc="showSearchInput = false; searchQuery = ''"
          />
          <svg class="w-4 h-4 absolute left-0 top-2.5 text-mute" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <button
            v-if="searchQuery"
            @click="searchQuery = ''"
            class="absolute right-0 top-2 p-0.5 text-mute hover:text-ink transition-colors"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </Transition>

    <!-- Search Toggle Button -->
    <button
      v-if="showSearch && !showSearchInput"
      @click="toggleSearch"
      class="p-2 text-mute hover:text-ink transition-colors flex-shrink-0"
      title="Search articles"
    >
      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
    </button>

    <!-- Header Actions Menu -->
    <div class="relative flex-shrink-0">
      <button
        ref="menuButtonRef"
        @click.stop="toggleMenu"
        class="p-2 transition-colors flex-shrink-0"
        :class="showMenu ? 'text-ink' : 'text-mute hover:text-ink'"
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
            @mark-all-read="showMenu = false; $emit('mark-all-read')"
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
  description?: string | null
  faviconUrl?: string
}

interface Props {
  menuIsOpen: boolean
  currentArticle: Article | null
  selectedFeed?: Feed | null
  selectedFeedId: number | null
  selectedTag: string | null
  isRefreshing?: boolean
  isLoading?: boolean
  unreadCount?: number
  totalCount?: number
  showSearch?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  selectedFeed: null,
  isRefreshing: false,
  isLoading: false,
  unreadCount: 0,
  totalCount: 0,
  showSearch: true
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

// The MonoLabel context line — the single accent moment in the header.
const contextLabel = computed(() => {
  if (props.selectedFeedId === -1) return 'SAVED'
  if (props.selectedFeed) return props.selectedFeed.title.toUpperCase()
  if (props.selectedTag === '__inbox__') return 'INBOX'
  if (props.selectedTag) return `#${props.selectedTag}`.toUpperCase()
  return 'ALL UNREAD'
})

// Optional serif subtitle (feed description) shown only in the default state.
const contextSubtitle = computed(() => {
  if (!props.currentArticle && props.selectedFeed?.description) {
    return props.selectedFeed.description
  }
  return ''
})

// Count rendered in mute.
const countLabel = computed(() => {
  if (props.selectedFeedId === -1) {
    return props.totalCount > 0 ? `${props.totalCount}` : ''
  }
  return props.unreadCount > 0 ? `${props.unreadCount} unread` : ''
})

const showMenu = ref(false)
const menuRef = ref<HTMLElement | null>(null)
const menuButtonRef = ref<HTMLElement | null>(null)

// Search functionality
const { searchQuery } = useArticleSearch()
const showSearchInput = ref(false)
const searchInputRef = ref<HTMLInputElement | null>(null)

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

const toggleSearch = () => {
  showSearchInput.value = !showSearchInput.value
  if (showSearchInput.value) {
    // Focus the search input after the transition
    nextTick(() => {
      searchInputRef.value?.focus()
    })
  } else {
    searchQuery.value = ''
  }
}

// Watch for search input visibility to focus
watch(showSearchInput, (visible) => {
  if (visible) {
    nextTick(() => {
      searchInputRef.value?.focus()
    })
  }
})
</script>

<style scoped>
/* Fade transition for loading indicator */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.fade-enter-to,
.fade-leave-from {
  opacity: 1;
}

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

/* Search transition */
.search-enter-active,
.search-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.search-enter-from,
.search-leave-to {
  opacity: 0;
  transform: translateX(10px);
}

.search-enter-to,
.search-leave-from {
  opacity: 1;
  transform: translateX(0);
}
</style>
