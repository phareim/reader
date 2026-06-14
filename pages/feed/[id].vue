<template>
  <DeckScreen
    v-if="!notFound"
    :key="feedId"
    :feed-id="feedId"
    :title="feedTitle"
    @not-found="notFound = true"
  />
  <main v-else class="mx-auto flex h-dvh max-w-xl flex-col px-4 pb-16 pt-4">
    <header class="flex items-baseline justify-between pb-3">
      <MonoLabel dash>The Reader</MonoLabel>
    </header>
    <HairlineRule />
    <div class="flex flex-1 flex-col items-center justify-center gap-4">
      <p class="text-body">No such feed.</p>
      <NuxtLink to="/sources"><ActionLabel accent>Back to sources</ActionLabel></NuxtLink>
    </div>
  </main>
</template>

<script setup lang="ts">
const route = useRoute()
const feedId = computed(() => Number(route.params.id))
const notFound = ref(false)

const { feeds, fetchFeeds } = useFeeds()
const feedTitle = computed(() => feeds.value.find(f => f.id === feedId.value)?.title)

onMounted(() => {
  if (Number.isNaN(feedId.value)) { notFound.value = true; return }
  if (!feeds.value.length) fetchFeeds()
})

watch(() => route.params.id, () => { notFound.value = false })
</script>
