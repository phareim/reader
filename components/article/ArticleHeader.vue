<template>
  <div class="px-2"
  :class="isExpanded ? 'py-2' : 'py-4'"
  >
    <div class="flex items-start justify-between gap-4">
      <div class="flex-1 min-w-0">
        <h2
          class="mb-1 font-spectral truncate text-lg view-transition-name:article-title"
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

        <!-- Actions Menu -->
        <div class="relative">
          <button
            ref="menuButtonRef"
            @click.stop="toggleActionsMenu"
            class="p-1.5 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded transition-colors"
            :class="showActionsMenu ? 'bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-gray-300' : 'text-gray-400 dark:text-gray-500'"
            :title="'Article actions'"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"/>
            </svg>
          </button>

          <!-- Actions Dropdown -->
          <Transition name="dropdown">
            <div
              v-if="showActionsMenu"
              ref="actionsMenuRef"
            >
              <ArticleActionsMenu
                :article="article"
                :is-saved="isSaved"
                :all-tags-with-counts="allTagsWithCounts"
                @toggle-save="$emit('toggle-save')"
                @toggle-read="$emit('toggle-read')"
                @update-tags="(savedArticleId, tags) => $emit('update-tags', savedArticleId, tags)"
                @delete-article="$emit('delete-article')"
              />
            </div>
          </Transition>
        </div>
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
  'toggle-read': []
  'update-tags': [savedArticleId: number, tags: string[]]
  'delete-article': []
}>()

const showActionsMenu = ref(false)
const actionsMenuRef = ref<HTMLElement | null>(null)
const menuButtonRef = ref<HTMLElement | null>(null)

// Close dropdown when clicking outside
onMounted(() => {
  const handleClickOutside = (event: MouseEvent) => {
    if (!showActionsMenu.value) return

    const target = event.target as HTMLElement

    // Check if click is outside both the menu and the toggle button
    const isOutsideMenu = actionsMenuRef.value && !actionsMenuRef.value.contains(target)
    const isOutsideButton = menuButtonRef.value && !menuButtonRef.value.contains(target)

    if (isOutsideMenu && isOutsideButton) {
      showActionsMenu.value = false
    }
  }

  document.addEventListener('mousedown', handleClickOutside)

  onUnmounted(() => {
    document.removeEventListener('mousedown', handleClickOutside)
  })
})

const toggleActionsMenu = () => {
  showActionsMenu.value = !showActionsMenu.value
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
