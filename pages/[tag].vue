<template>
  <DeckScreen v-if="!notFound" :key="tag" :tag="tag" @not-found="notFoundTag = tag" />
  <main v-else class="mx-auto flex h-dvh max-w-xl flex-col px-4 pb-16 pt-4">
    <header class="flex items-baseline justify-between pb-3">
      <MonoLabel dash>The Reader</MonoLabel>
    </header>
    <HairlineRule desk />
    <div class="flex flex-1 flex-col items-center justify-center gap-4">
      <p class="text-body">No tag named "{{ tag }}".</p>
      <NuxtLink to="/"><ActionLabel accent>Back to the deck</ActionLabel></NuxtLink>
    </div>
  </main>
</template>

<script setup lang="ts">
const route = useRoute()
const tag = computed(() => String(route.params.tag))
// The tag the server (or the deck) answered "Tag not found" for. useState, so
// the SSR verdict hydrates into the same not-found sheet.
const notFoundTag = useState<string | null>('tag-not-found', () => null)
const notFound = computed(() => notFoundTag.value === tag.value)
watch(() => route.params.tag, () => { notFoundTag.value = null })
onBeforeUnmount(() => { notFoundTag.value = null })

// Unknown paths land here too, so SSR answers 404 for them. The rule is
// the deck's own: /api/articles?tag= answers 404 "Tag not found" only when
// the signed-in reader has no such tag (case-insensitive, as the deck
// matches). So a real tag is never 404'd. Any other outcome (no session,
// 5xx, network) leaves the page as before.
if (import.meta.server) {
  try {
    await useRequestFetch()('/api/articles', { params: { tag: tag.value, limit: 1 } })
  } catch (err: any) {
    if (err?.statusCode === 404 && err?.data?.statusMessage === 'Tag not found') {
      notFoundTag.value = tag.value
      setResponseStatus(useRequestEvent()!, 404)
    }
  }
}
</script>
