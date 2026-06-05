<template>
  <div class="dropdown-menu-container absolute right-0 mt-1 w-64 bg-paper border border-rule z-50">
    <!-- Add Feed -->
    <div class="px-almanac-gutter py-3 border-b border-rule">
      <MonoLabel as="div">ADD TO THE LIBRARY</MonoLabel>
      <div class="mt-2">
        <FeedUrlInput
          @success="(msg) => $emit('success', msg)"
          @error="(msg) => $emit('error', msg)"
        />
      </div>
    </div>

    <!-- View Saved Articles -->
    <NuxtLink
      to="/saved"
      class="w-full text-left px-almanac-gutter py-2.5 font-serif text-[14px] text-ink hover:text-rust transition-colors flex items-center gap-2"
    >
      <svg class="w-4 h-4 text-mute" fill="currentColor" viewBox="0 0 24 24">
        <path d="M17 3H7c-1.1 0-2 .9-2 2v16l7-3 7 3V5c0-1.1-.9-2-2-2z"/>
      </svg>
      <span>View saved articles</span>
    </NuxtLink>

    <!-- Refresh Feed (only show if a feed is selected) -->
    <button
      v-if="selectedFeedId && selectedFeedId > 0"
      @click="$emit('refresh-feed')"
      :disabled="isRefreshing"
      class="w-full text-left px-almanac-gutter py-2.5 font-serif text-[14px] text-ink hover:text-rust transition-colors flex items-center gap-2 border-t border-rule"
      :class="{ 'opacity-50 cursor-not-allowed': isRefreshing }"
    >
      <svg
        class="w-4 h-4 text-mute transition-transform"
        :class="{ 'animate-spin': isRefreshing }"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
      </svg>
      <span>{{ isRefreshing ? 'Refreshing…' : 'Refresh feed' }}</span>
    </button>

    <!-- Mark all as read (only show if a feed is selected) -->
    <button
      v-if="selectedFeedId && selectedFeedId > 0"
      @click="$emit('mark-all-read')"
      class="w-full text-left px-almanac-gutter py-2.5 font-serif text-[14px] text-ink hover:text-rust transition-colors flex items-center gap-2 border-t border-rule"
    >
      <svg class="w-4 h-4 text-mute" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <span>Mark all as read</span>
    </button>

    <!-- Summarize articles (show if feed or tag is selected) -->
    <button
      v-if="canSummarize"
      @click="handleSummarize"
      :disabled="summarizing"
      class="w-full text-left px-almanac-gutter py-2.5 font-serif text-[14px] text-ink hover:text-rust transition-colors flex items-center gap-2 border-t border-rule disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <svg
        v-if="!summarizing"
        class="w-4 h-4 text-mute"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
      </svg>
      <svg
        v-else
        class="w-4 h-4 text-mute animate-spin"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
      </svg>
      <span>{{ summarizing ? 'Generating…' : 'Summarize articles' }}</span>
    </button>

    <!-- Sign Out -->
    <button
      @click="$emit('sign-out')"
      class="w-full text-left px-almanac-gutter py-2.5 font-serif text-[14px] text-mute hover:text-rust transition-colors flex items-center gap-2 border-t border-rule"
    >
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
      </svg>
      <span>Sign out</span>
    </button>
  </div>
</template>

<script setup lang="ts">
interface Props {
  selectedFeedId?: number | null
  isRefreshing?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  selectedFeedId: null,
  isRefreshing: false
})

defineEmits<{
  'sign-out': []
  'refresh-feed': []
  'mark-all-read': []
  'success': [message: string]
  'error': [message: string]
}>()

// Access global state
const { selectedTag } = useFeeds()
const { summarize, loading: summarizing, error: summarizeError } = useSummarize()

// Determine if summarize button should be shown
const canSummarize = computed(() => {
  return (props.selectedFeedId && props.selectedFeedId > 0) || !!selectedTag.value
})

// Handle summarize click
const handleSummarize = async () => {
  try {
    if (props.selectedFeedId && props.selectedFeedId > 0) {
      // Summarize specific feed
      await summarize({
        feedId: props.selectedFeedId,
        limit: 20,
        isRead: false  // Only unread by default
      })
    } else if (selectedTag.value) {
      // Summarize tag
      await summarize({
        tag: selectedTag.value,
        limit: 30,
        isRead: false
      })
    }
  } catch (error) {
    console.error('Error triggering summarization:', error)
  }
}
</script>
