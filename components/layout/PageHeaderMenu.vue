<template>
  <div class="dropdown-menu-container absolute right-0 mt-1 w-64 bg-white dark:bg-zinc-800 rounded-lg shadow-lg border border-gray-200 dark:border-zinc-700 z-50">
    <!-- Mark All as Read -->
    <button
      v-if="selectedFeedId !== -2 && selectedFeedId !== null"
      @click="$emit('mark-all-read')"
      class="w-full text-left px-4 py-2 text-base text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-700 rounded-t-lg transition-colors flex items-center gap-2"
    >
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <span>Mark all as read</span>
    </button>

    <!-- Refresh Current Feed / Sync All -->
    <button
      v-if="selectedFeedId && selectedFeedId > 0"
      @click="$emit('refresh-feed')"
      class="w-full text-left px-4 py-2 text-base text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-700 transition-colors flex items-center gap-2 border-t border-gray-200 dark:border-zinc-700"
    >
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
      </svg>
      <span>Refresh feed</span>
    </button>

    <button
      @click="$emit('sync-all')"
      class="w-full text-left px-4 py-2 text-base text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-700 transition-colors flex items-center gap-2 border-t border-gray-200 dark:border-zinc-700"
    >
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
      </svg>
      <span>Sync all feeds</span>
    </button>

    <!-- Add Feed -->
    <div class="px-4 py-2 border-t border-gray-200 dark:border-zinc-700">
      <div class="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2">Add Feed</div>
      <FeedUrlInput
        @success="(msg) => $emit('success', msg)"
        @error="(msg) => $emit('error', msg)"
      />
    </div>

    <!-- View Saved Articles -->
    <button
      @click="$emit('view-saved')"
      class="w-full text-left px-4 py-2 text-base text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-700 transition-colors flex items-center gap-2 border-t border-gray-200 dark:border-zinc-700"
    >
      <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
        <path d="M17 3H7c-1.1 0-2 .9-2 2v16l7-3 7 3V5c0-1.1-.9-2-2-2z"/>
      </svg>
      <span>Saved articles</span>
    </button>

    <!-- Sign Out -->
    <button
      @click="$emit('sign-out')"
      class="w-full text-left px-4 py-2 text-base text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-b-lg transition-colors flex items-center gap-2 border-t border-gray-200 dark:border-zinc-700"
    >
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
      </svg>
      <span>Sign out</span>
    </button>
  </div>
</template>

<script setup lang="ts">
interface Props {
  selectedFeedId: number | null
}

defineProps<Props>()

defineEmits<{
  'mark-all-read': []
  'refresh-feed': []
  'sync-all': []
  'view-saved': []
  'sign-out': []
  'success': [message: string]
  'error': [message: string]
}>()
</script>
