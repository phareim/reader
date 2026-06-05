<template>
  <div class="flex-shrink-0 border-t border-rule px-almanac-gutter py-4 flex items-center gap-3 bg-paper">
    <ActionLabel
      :label="syncLoading ? 'SYNCING…' : 'SYNC ALL'"
      :disabled="syncLoading"
      @click="handleSyncAll"
    />

    <!-- Sign Out — only when logged in -->
    <ActionLabel
      v-if="loggedIn"
      label="SIGN OUT"
      @click="handleSignOut"
    />

    <!-- Sign In — only when logged out -->
    <NuxtLink v-else to="/login">
      <ActionLabel label="SIGN IN" accent @click="() => {}" />
    </NuxtLink>
  </div>
</template>

<script setup lang="ts">
const syncLoading = ref(false)
const { syncAll } = useFeeds()
const { loggedIn, signOut } = useAuth()

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
  await signOut()
  navigateTo('/login')
}
</script>
