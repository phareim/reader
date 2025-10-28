<template>
  <div class="dropdown-menu-container absolute right-0 mt-1 w-64 bg-white dark:bg-zinc-800 rounded-lg shadow-lg border border-gray-200 dark:border-zinc-700 z-50">
    <!-- Save/Unsave Article -->
    <button
      @click="$emit('toggle-save')"
      class="w-full text-left px-4 py-2 text-base text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-700 rounded-t-lg transition-colors flex items-center gap-2"
    >
      <svg v-if="isSaved" class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
        <path d="M17 3H7c-1.1 0-2 .9-2 2v16l7-3 7 3V5c0-1.1-.9-2-2-2z"/>
      </svg>
      <svg v-else class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"/>
      </svg>
      <span>{{ isSaved ? 'Unsave article' : 'Save article' }}</span>
    </button>

    <!-- Mark as Read/Unread -->
    <button
      @click="$emit('toggle-read')"
      class="w-full text-left px-4 py-2 text-base text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-700 transition-colors flex items-center gap-2 border-t border-gray-200 dark:border-zinc-700"
    >
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <span>{{ article.isRead ? 'Mark as unread' : 'Mark as read' }}</span>
    </button>

    <!-- Tags Management (only for saved articles) -->
    <div v-if="isSaved && article.savedId" class="px-4 py-2 border-t border-gray-200 dark:border-zinc-700">
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
        placeholder="Add tag (3+ chars)"
        :existing-tags="article.tags || []"
        :all-tags="allTagsWithCounts"
        @add-tag="handleAddTag"
        @click.stop
      />
    </div>

    <!-- Copy Link -->
    <button
      @click="copyLink"
      class="w-full text-left px-4 py-2 text-base text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-700 transition-colors flex items-center gap-2 border-t border-gray-200 dark:border-zinc-700"
    >
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
      </svg>
      <span>{{ linkCopied ? 'Link copied!' : 'Copy link' }}</span>
    </button>

    <!-- Open in New Tab -->
    <a
      :href="article.url"
      target="_blank"
      rel="noopener noreferrer"
      :class="[
        'w-full text-left px-4 py-2 text-base text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-700 transition-colors flex items-center gap-2 border-t border-gray-200 dark:border-zinc-700',
        !isManualArticle ? 'rounded-b-lg' : ''
      ]"
      @click.stop
    >
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/>
      </svg>
      <span>Open in new tab</span>
    </a>

    <!-- Delete Article (only for manually added articles) -->
    <button
      v-if="isManualArticle"
      @click="handleDelete"
      class="w-full text-left px-4 py-2 text-base text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-b-lg transition-colors flex items-center gap-2 border-t border-gray-200 dark:border-zinc-700"
    >
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
      </svg>
      <span>Delete article</span>
    </button>
  </div>
</template>

<script setup lang="ts">
interface Article {
  id: number
  title: string
  url: string
  isRead: boolean
  savedId?: number
  tags?: string[]
  feedTitle?: string
}

interface Props {
  article: Article
  isSaved: boolean
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

const linkCopied = ref(false)

const isManualArticle = computed(() => {
  return props.article.feedTitle === 'Manual Additions'
})

const copyLink = async () => {
  try {
    await navigator.clipboard.writeText(props.article.url)
    linkCopied.value = true
    setTimeout(() => {
      linkCopied.value = false
    }, 2000)
  } catch (err) {
    console.error('Failed to copy link:', err)
  }
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

const handleDelete = () => {
  if (confirm('Are you sure you want to permanently delete this article?')) {
    emit('delete-article')
  }
}
</script>
