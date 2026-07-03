<template>
  <main class="mx-auto max-w-measure px-5 py-6 pb-20">
    <header class="flex items-baseline justify-between">
      <MonoLabel dash>Shelf</MonoLabel>
      <MonoLabel>{{ articles.length }} saved</MonoLabel>
    </header>
    <HairlineRule class="mt-3" />

    <p v-if="loading" class="mt-8 italic text-mute">Loading…</p>
    <p v-else-if="articles.length === 0" class="mt-8 italic text-mute">
      Nothing on the shelf yet — swipe a card right when something touches you.
    </p>

    <ul v-else>
      <li v-for="a in articles" :key="a.id" class="border-b border-rule py-4">
        <NuxtLink :to="`/article/${a.id}`" class="block">
          <div class="flex items-baseline justify-between gap-4">
            <MonoLabel dash>{{ a.feedTitle }}</MonoLabel>
            <MonoLabel>{{ a.publishedAt ? formatRelativeDate(a.publishedAt) : '' }}</MonoLabel>
          </div>
          <h2 class="mt-1 text-xl leading-snug text-ink">{{ a.title }}</h2>
          <p class="mt-1 text-sm text-mute">{{ excerpt(a.content || a.summary, 140) }}</p>
        </NuxtLink>
        <div class="mt-2 flex items-center justify-between">
          <div class="flex flex-wrap gap-x-3">
            <MonoLabel v-for="t in a.tags || []" :key="t">{{ t }}</MonoLabel>
          </div>
          <button
            class="font-mono uppercase text-mute hover:text-accent-ink focus-visible:outline focus-visible:outline-1"
            style="font-size: 10px; letter-spacing: 0.16em;"
            @click="remove(a.id)"
          >&mdash; Remove</button>
        </div>
      </li>
    </ul>
  </main>
</template>

<script setup lang="ts">
import type { Article } from '~/types'
import { excerpt } from '~/utils/cardData'
import { formatRelativeDate } from '~/utils/formatDate'

const { unsaveArticle } = useSavedArticles()
const { showError, showSuccess } = useToast()

const articles = ref<Article[]>([])
const loading = ref(true)

async function load() {
  loading.value = true
  try {
    const res = await $fetch<{ articles: Article[] }>('/api/saved-articles')
    articles.value = res.articles
  } catch {
    showError('Could not load the shelf')
  } finally {
    loading.value = false
  }
}

async function remove(id: number) {
  try {
    await unsaveArticle(id)
    articles.value = articles.value.filter((a) => a.id !== id)
    showSuccess('Removed from shelf')
  } catch {
    showError('Could not remove')
  }
}

onMounted(() => load())
</script>
