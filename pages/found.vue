<template>
  <DeckScreen v-if="foundFeed" :key="foundFeed.id" :feed-id="foundFeed.id" title="Found" />
  <main v-else class="mx-auto flex h-dvh max-w-xl flex-col px-4 pb-16 pt-4">
    <header class="flex items-baseline justify-between pb-3">
      <MonoLabel dash>Found</MonoLabel>
    </header>
    <HairlineRule />
    <div class="flex flex-1 flex-col items-center justify-center gap-4 text-center">
      <template v-if="loading">
        <MonoLabel dash>Loading…</MonoLabel>
      </template>
      <template v-else>
        <p class="max-w-measure text-body">
          Nothing found yet. Bookmarks you save on X — and other sources later —
          land here automatically.
        </p>
        <NuxtLink to="/"><ActionLabel>Back to the deck</ActionLabel></NuxtLink>
      </template>
    </div>
  </main>
</template>

<script setup lang="ts">
const { feeds, fetchFeeds, loading } = useFeeds()

const foundFeed = computed(() => feeds.value.find(f => f.kind === 'found'))

onMounted(() => {
  if (!feeds.value.length) fetchFeeds()
})
</script>
