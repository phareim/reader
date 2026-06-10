<template>
  <DeckScreen v-if="!notFound" :key="tag" :tag="tag" @not-found="notFound = true" />
  <main v-else class="mx-auto flex h-dvh max-w-xl flex-col px-4 pb-16 pt-4">
    <header class="flex items-baseline justify-between pb-3">
      <MonoLabel dash>The Reader</MonoLabel>
    </header>
    <HairlineRule />
    <div class="flex flex-1 flex-col items-center justify-center gap-4">
      <p class="text-body">No tag named "{{ tag }}".</p>
      <NuxtLink to="/"><ActionLabel accent>Back to the deck</ActionLabel></NuxtLink>
    </div>
  </main>
</template>

<script setup lang="ts">
const route = useRoute()
const tag = computed(() => String(route.params.tag))
const notFound = ref(false)
watch(() => route.params.tag, () => { notFound.value = false })
</script>
