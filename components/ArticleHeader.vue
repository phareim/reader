<template>
  <div class="px-6"
  :class="isExpanded ? 'py-2' : 'py-4'"
  >
    <div class="flex items-start justify-between gap-4">
      <div class="flex-1 min-w-0">
        <h2
          class="mb-1 font-spectral truncate text-lg"
          :class="titleClasses()"
        >
          {{ article.title }}
        </h2>
        <div class="text-sm text-gray-500 dark:text-gray-400">
          <span v-if="showFeedTitle">{{ article.feedTitle }} • </span>
          {{ formatDate(article.publishedAt) }}
          <span v-if="article.author"> • {{ article.author }}</span>
        </div>
      </div>
      <div class="flex items-center gap-3">
        <span v-if="!article.isRead" class="text-blue-500 dark:text-blue-400 text-2xl leading-none">•</span>

        <!-- Bookmark/Save Button -->
        <button
          @click.stop="$emit('toggle-save')"
          class="p-1.5 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded transition-colors"
          :class="isSaved ? 'text-yellow-500 dark:text-yellow-400' : 'text-gray-400 dark:text-gray-500'"
          :title="isSaved ? 'Unsave article' : 'Save article'"
        >
          <svg v-if="isSaved" class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M17 3H7c-1.1 0-2 .9-2 2v16l7-3 7 3V5c0-1.1-.9-2-2-2z"/>
          </svg>
          <svg v-else class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"/>
          </svg>
        </button>

        <!-- Tags Menu (only for saved articles) -->
        <div v-if="isSaved && article.savedId" class="relative">
          <button
            @click.stop="toggleTagsMenu"
            class="p-1.5 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded transition-colors"
            :class="showTagsMenu ? 'bg-gray-100 dark:bg-zinc-800 text-purple-500 dark:text-purple-400' : 'text-gray-400 dark:text-gray-500'"
            title="Manage tags"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"/>
            </svg>
          </button>

          <!-- Tags Dropdown -->
          <Transition name="dropdown">
            <div
              v-if="showTagsMenu"
              ref="tagsMenuRef"
              class="dropdown-menu-container absolute right-0 mt-1 w-64 bg-white dark:bg-zinc-800 rounded-lg shadow-lg border border-gray-200 dark:border-zinc-700 z-50"
            >
              <div class="px-4 py-2">
                <div class="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2">Tags</div>

                <!-- Current Tags -->
                <div v-if="article.tags && article.tags.length > 0" class="flex flex-wrap gap-1 mb-2">
                  <button
                    v-for="tag in article.tags"
                    :key="tag"
                    @click="handleRemoveTag(tag)"
                    class="group flex items-center gap-1 text-xs px-1.5 py-0.5 rounded bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 hover:bg-red-100 dark:hover:bg-red-900/30 hover:text-red-700 dark:hover:text-red-300 transition-colors"
                    title="Click to remove"
                  >
                    <span>#{{ tag }}</span>
                    <svg class="w-3 h-3 opacity-50 group-hover:opacity-100" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                    </svg>
                  </button>
                </div>
                <div v-else class="text-xs text-gray-500 dark:text-gray-400 mb-2">No tags yet</div>

                <!-- Add Tag Input -->
                <TagInput
                  placeholder="Add tag (3+ chars for suggestions)"
                  :existing-tags="article.tags || []"
                  :all-tags="allTagsWithCounts"
                  @add-tag="handleAddTag"
                  @click.stop
                />
              </div>
            </div>
          </Transition>
        </div>

        <a
          :href="article.url"
          target="_blank"
          class="text-blue-500 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 text-sm inline-flex items-center"
          @click.stop
          rel="noopener noreferrer"
          aria-label="Open original article in a new tab"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 4h6m0 0v6m0-6L10 14"/>
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4"/>
          </svg>
          <span class="sr-only">Open external link</span>
        </a>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { formatDistanceToNow } from 'date-fns'

interface Article {
  id: number
  title: string
  url: string
  author?: string
  publishedAt?: string
  isRead: boolean
  feedTitle?: string
  savedId?: number
  tags?: string[]
}

interface Props {
  article: Article
  isExpanded: boolean
  isSaved: boolean
  showFeedTitle?: boolean
  allTagsWithCounts?: Array<{ name: string; feedCount: number; savedArticleCount: number }>
}

const props = withDefaults(defineProps<Props>(), {
  allTagsWithCounts: () => []
})

const emit = defineEmits<{
  'toggle-save': []
  'update-tags': [savedArticleId: number, tags: string[]]
}>()

const showTagsMenu = ref(false)
const tagsMenuRef = ref<HTMLElement | null>(null)

// Close dropdown when clicking outside
onMounted(() => {
  const handleClickOutside = (event: MouseEvent) => {
    if (tagsMenuRef.value && !tagsMenuRef.value.contains(event.target as Node)) {
      const target = event.target as HTMLElement
      // Don't close if clicking the toggle button
      if (!target.closest('button[title="Manage tags"]')) {
        showTagsMenu.value = false
      }
    }
  }

  document.addEventListener('mousedown', handleClickOutside)

  onUnmounted(() => {
    document.removeEventListener('mousedown', handleClickOutside)
  })
})

const toggleTagsMenu = () => {
  showTagsMenu.value = !showTagsMenu.value
}

const handleAddTag = (tag: string) => {
  if (!props.article.savedId) return

  const currentTags = props.article.tags || []
  const updatedTags = [...currentTags, tag]
  emit('update-tags', props.article.savedId, updatedTags)
}

const handleRemoveTag = (tagToRemove: string) => {
  if (!props.article.savedId) return

  const currentTags = props.article.tags || []
  const updatedTags = currentTags.filter(t => t !== tagToRemove)
  emit('update-tags', props.article.savedId, updatedTags)
}

const formatDate = (date?: string) => {
  if (!date) return 'Unknown date'
  try {
    return formatDistanceToNow(new Date(date), { addSuffix: true })
  } catch {
    return 'Unknown date'
  }
}

const titleClasses = () => {
  let returnValue = 'font-spectral truncate'
  if (props.article.isRead) {
    returnValue += ' font-normal text-gray-700 dark:text-gray-300'
  } else {
    returnValue += ' font-bold text-gray-900 dark:text-gray-100'
  }
  if (props.isExpanded) {
    returnValue += ' text-sm'
  }else {
    returnValue += ' text-lg'
  }
  return returnValue
}
</script>

<style scoped>
h2 {
  transition: font-size 0.15s ease-in-out;
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
