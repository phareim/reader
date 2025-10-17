<template>
  <div
    class="border-b border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 cursor-pointer transition-colors"
    :class="{
      /* Modern left accent for selection */
      'border-l-4 border-blue-500 bg-blue-50 dark:bg-zinc-800/50 shadow-sm': isSelected && !isExpanded,
      /* Strong accent when expanded */
      'border-l-4 border-blue-600 bg-white dark:bg-zinc-900 shadow': isExpanded
    }"
    @click="$emit('open', article.id)"
  >
    <!-- Article Header -->
    <div class="px-6 py-4">
      <div class="flex items-start justify-between gap-4">
        <div class="flex-1 min-w-0">
          <h2
            class="text-lg mb-1 font-spectral"
            :class="article.isRead ? 'font-normal text-gray-700 dark:text-gray-300' : 'font-bold text-gray-900 dark:text-gray-100'"
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
            @click.stop="$emit('toggle-save', article.id)"
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

    <!-- Article Content (Expanded Inline) -->
    <Transition name="expand">
      <div v-if="isExpanded" class="border-t border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-950/60 py-6">
        <div class="max-w-3xl mx-auto px-6">
          <div
            v-if="article.content"
            class="prose prose-md dark:prose-invert max-w-none font-spectral"
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
import { formatDistanceToNow } from 'date-fns'

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
}

defineProps<Props>()

defineEmits<{
  open: [id: number]
  'toggle-save': [id: number]
}>()

const formatDate = (dateStr: string | null | undefined) => {
  if (!dateStr) return 'Unknown date'
  try {
    return formatDistanceToNow(new Date(dateStr), { addSuffix: true })
  } catch {
    return 'Unknown date'
  }
}
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
