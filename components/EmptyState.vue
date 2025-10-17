<template>
  <div class="px-6 py-8">
    <!-- No feeds at all -->
    <div v-if="type === 'no-feeds'" class="text-center text-gray-500 dark:text-gray-400">
      No feeds yet. Open the menu to add feeds!
    </div>

    <!-- All caught up -->
    <div v-else-if="type === 'all-caught-up'" class="max-w-2xl mx-auto">
      <h2 class="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-12 text-center">
        All caught up! 🎉
      </h2>

      <div class="space-y-3" v-show="hasUnreadInOtherViews">
        <!-- Tags with unread articles -->
        <div v-for="tag in tagsWithUnread" :key="tag.name">
          <button
            @click="$emit('select-tag', tag.name)"
            class="w-full flex items-center justify-between px-6 py-4 bg-white dark:bg-zinc-900 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-lg border border-gray-200 dark:border-zinc-800 transition-colors text-left"
          >
            <div class="flex items-center gap-3">
              <span class="text-2xl">#</span>
              <span class="text-lg font-medium text-gray-900 dark:text-gray-100">{{ tag.name }}</span>
            </div>
            <div class="flex items-center gap-2">
              <span class="text-sm text-gray-500 dark:text-gray-400">{{ tag.unreadCount }} unread</span>
              <svg class="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </button>
        </div>

        <!-- Inbox with unread articles -->
        <div v-if="inboxUnreadCount > 0">
          <button
            @click="$emit('select-tag', '__inbox__')"
            class="w-full flex items-center justify-between px-6 py-4 bg-white dark:bg-zinc-900 hover:bg-gray-50 dark:hover:bg-zinc-800/50 rounded-lg border border-gray-200 dark:border-zinc-800 transition-colors text-left"
          >
            <div class="flex items-center gap-3">
              <span class="text-2xl">📥</span>
              <span class="text-lg font-medium text-gray-900 dark:text-gray-100">Inbox</span>
            </div>
            <div class="flex items-center gap-2">
              <span class="text-sm text-gray-500 dark:text-gray-400">{{ inboxUnreadCount }} unread</span>
              <svg class="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </button>
        </div>

        <!-- If no unread at all -->
        <div v-if="totalUnreadCount === 0" class="text-center py-8">
          <p class="text-gray-500 dark:text-gray-400 mb-4">
            No unread articles anywhere!
          </p>
          <button
            @click="$emit('sync-all')"
            class="px-6 py-3 bg-blue-500 dark:bg-blue-600 text-white rounded-lg hover:bg-blue-600 dark:hover:bg-blue-700 transition-colors inline-flex items-center gap-2"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span>Refresh All Feeds</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
interface Tag {
  name: string
  unreadCount: number
}

interface Props {
  type: 'no-feeds' | 'all-caught-up'
  tagsWithUnread?: Tag[]
  inboxUnreadCount?: number
  totalUnreadCount?: number
  hasUnreadInOtherViews?: boolean
}

withDefaults(defineProps<Props>(), {
  tagsWithUnread: () => [],
  inboxUnreadCount: 0,
  totalUnreadCount: 0,
  hasUnreadInOtherViews: false
})

defineEmits<{
  'select-tag': [tag: string]
  'sync-all': []
}>()
</script>
