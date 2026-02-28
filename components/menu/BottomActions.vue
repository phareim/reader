<template>
  <div class="flex-shrink-0 border-t border-gray-200 dark:border-zinc-800 p-2 space-y-2 bg-white dark:bg-zinc-900">
    <button @click="handleSyncAll" :disabled="syncLoading"
      class="w-full text-left px-3 py-2 text-base text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg transition-colors flex items-center gap-2">
      <svg class="w-5 h-5" :class="{ 'animate-spin': syncLoading }" fill="none" stroke="currentColor"
        viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
          d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
      </svg>
      <span>{{ syncLoading ? 'Syncing...' : 'Sync All Feeds' }}</span>
    </button>

    <!-- Sign Out Button - Only show when logged in -->
    <button v-if="loggedIn" @click="handleSignOut"
      class="w-full text-left px-3 py-2 text-base text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors flex items-center gap-2">
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
          d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
      </svg>
      <span>Sign Out</span>
    </button>

    <!-- Sign In Link - Only show when logged out -->
    <NuxtLink v-else to="/login"
      class="block w-full text-left px-3 py-2 text-base text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors flex items-center gap-2">
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
          d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
      </svg>
      <span>Sign In</span>
    </NuxtLink>
  </div>
</template>

<script setup lang="ts">
const syncLoading = ref(false)
const { syncAll } = useFeeds()
const { loggedIn, clear } = useUserSession()

const emit = defineEmits(['success', 'error'])

const handleSyncAll = async () => {
  syncLoading.value = true

  try {
    const result = await syncAll()
    emit('success', `Synced ${result.summary.total} feeds. ${result.summary.newArticles} new articles.`)
  } catch (err: any) {
    emit('error', 'Failed to sync feeds')
  } finally {
    syncLoading.value = false
  }
}

const handleSignOut = async () => {
  await clear()
  navigateTo('/login')
}
</script>
