<template>
  <!-- Hairline paper popover — no shadow, no radius -->
  <div class="dropdown-menu-container absolute right-0 mt-1 w-64 bg-paper border border-rule z-50">
    <!-- Save/Unsave Article -->
    <button
      @click="$emit('toggle-save')"
      class="w-full text-left px-4 py-2.5 font-serif text-[14px] text-ink hover:text-rust transition-colors flex items-center gap-2"
    >
      <span class="mono-label" :class="isSaved ? 'text-rust' : ''">{{ isSaved ? 'STORED' : 'STORE' }}</span>
      <span class="ml-auto">{{ isSaved ? 'Unsave article' : 'Save article' }}</span>
    </button>

    <!-- Mark as Read/Unread -->
    <button
      @click="$emit('toggle-read')"
      class="w-full text-left px-4 py-2.5 font-serif text-[14px] text-ink hover:text-rust transition-colors flex items-center gap-2 border-t border-rule"
    >
      <span class="mono-label">{{ article.isRead ? 'UNREAD' : 'READ' }}</span>
      <span class="ml-auto">{{ article.isRead ? 'Mark as unread' : 'Mark as read' }}</span>
    </button>

    <!-- Tags Management (only for saved articles) -->
    <div v-if="isSaved && article.savedId" class="px-4 py-3 border-t border-rule">
      <div class="mono-label mb-2">TAGS</div>

      <!-- Current Tags -->
      <div v-if="article.tags && article.tags.length > 0" class="flex flex-wrap gap-x-3 gap-y-1 mb-2">
        <button
          v-for="tag in article.tags"
          :key="tag"
          @click="handleRemoveTag(tag)"
          class="group inline-flex items-baseline font-serif text-[13px] text-mute hover:text-rust transition-colors"
          title="Click to remove"
        >
          <span>#{{ tag }}</span>
          <span class="ml-1 text-mute group-hover:text-rust">&times;</span>
        </button>
      </div>
      <div v-else class="font-serif text-[13px] text-mute mb-2">No tags yet</div>

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
      class="w-full text-left px-4 py-2.5 font-serif text-[14px] text-ink hover:text-rust transition-colors flex items-center gap-2 border-t border-rule"
    >
      <span class="mono-label" :class="linkCopied ? 'text-rust' : ''">{{ linkCopied ? 'COPIED' : 'LINK' }}</span>
      <span class="ml-auto">{{ linkCopied ? 'Link copied!' : 'Copy link' }}</span>
    </button>

    <!-- Open in New Tab -->
    <a
      :href="article.url"
      target="_blank"
      rel="noopener noreferrer"
      class="w-full text-left px-4 py-2.5 font-serif text-[14px] text-ink hover:text-rust transition-colors flex items-center gap-2 border-t border-rule"
      @click.stop
    >
      <span class="mono-label">OPEN</span>
      <span class="ml-auto">Open in new tab</span>
    </a>

    <!-- Delete Article (only for manually added articles) -->
    <button
      v-if="isManualArticle"
      @click="handleDelete"
      class="w-full text-left px-4 py-2.5 font-serif text-[14px] text-mute hover:text-rust transition-colors flex items-center gap-2 border-t border-rule"
    >
      <span class="mono-label">DELETE</span>
      <span class="ml-auto">Delete article</span>
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
