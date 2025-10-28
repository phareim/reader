<template>
  <div
    :id="`article-${article.id}`"
    :data-article-id="article.id"
    class="border-b border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 cursor-pointer transition-colors scroll-mt-16"
    :class="{
      /* Modern left accent for selection */
      'border-l-4 border-blue-500 bg-blue-50 dark:bg-zinc-800/50 shadow-sm': isSelected && !isExpanded,
      /* Strong accent when expanded */
      'border-l-4 border-blue-600 bg-white dark:bg-zinc-900 shadow': isExpanded
    }"
    @click="$emit('open', article.id)"
  >
    <!-- Article Header -->
    <ArticleHeader
      :is-expanded="isExpanded"
      :article="article"
      :is-saved="isSaved"
      :show-feed-title="showFeedTitle"
      :all-tags-with-counts="allTagsWithCounts"
      @toggle-save="$emit('toggle-save', article.id)"
      @toggle-read="$emit('toggle-read', article.id)"
      @update-tags="(savedArticleId, tags) => $emit('update-tags', savedArticleId, tags)"
      @delete-article="$emit('delete-article', article.id)"
    />

    <!-- Article Content (Expanded Inline) -->
    <Transition name="expand">
      <div v-if="isExpanded" class="border-t border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-dark-bg/60 py-6">
        <div class="max-w-3xl mx-auto px-2">
          <div
            v-if="article.content"
            class="prose prose-xl dark:prose-invert max-w-none font-spectral"
            v-html="article.content"
          ></div>
          <div v-else-if="article.summary" class="text-gray-700 dark:text-gray-300 font-spectral prose prose-md dark:prose-invert max-w-none">
            {{ article.summary }}
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
interface Article {
  id: number
  title: string
  url: string
  author?: string
  content?: string
  summary?: string
  publishedAt?: string
  isRead: boolean
  feedTitle?: string
}

interface Props {
  article: Article
  isSelected: boolean
  isExpanded: boolean
  isSaved: boolean
  showFeedTitle?: boolean
  allTagsWithCounts?: Array<{ name: string; feedCount: number; savedArticleCount: number }>
}

withDefaults(defineProps<Props>(), {
  allTagsWithCounts: () => []
})

defineEmits<{
  open: [id: number]
  'toggle-save': [id: number]
  'toggle-read': [id: number]
  'update-tags': [savedArticleId: number, tags: string[]]
  'delete-article': [id: number]
}>()
</script>

<style scoped>
/* Expand transition for article content */
.expand-enter-active,
.expand-leave-active {
  transition: all 0.3s ease;
  overflow: hidden;
}

.expand-enter-from,
.expand-leave-to {
  max-height: 0;
  opacity: 0;
}

.expand-enter-to,
.expand-leave-from {
  max-height: 10000px;
  opacity: 1;
}
</style>
