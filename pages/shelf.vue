<template>
  <main class="mx-auto max-w-measure px-5 py-6 pb-20">
    <header class="flex items-baseline justify-between">
      <MonoLabel dash>Shelf</MonoLabel>
      <MonoLabel>{{ articles.length }} saved</MonoLabel>
    </header>
    <HairlineRule class="mt-3" />

    <!-- Flat tag filter — derived from the current page of articles (v1 limitation) -->
    <div v-if="tags.length" class="flex flex-wrap gap-x-4 gap-y-2 py-3">
      <button
        v-for="t in ['', ...tags]"
        :key="t || '__all__'"
        class="font-mono uppercase"
        style="font-size: 10px; letter-spacing: 0.16em;"
        :class="activeTag === t ? 'text-accent-ink' : 'text-mute'"
        @click="setTag(t)"
      >{{ t || 'All' }}</button>
    </div>
    <HairlineRule v-if="tags.length" />

    <p v-if="loading" class="mt-8 italic text-mute">Loading…</p>
    <p v-else-if="articles.length === 0" class="mt-8 italic text-mute">
      Nothing on the shelf yet — swipe a card left when something touches you.
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
            class="font-mono uppercase text-mute hover:text-accent-ink"
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
const activeTag = ref('')

// Tags derive from the current loaded page of articles (v1 limitation:
// when a tag filter is active the chip list only covers what's visible,
// not the full saved corpus).
const tags = computed(() => {
  const set = new Set<string>()
  for (const a of articles.value) for (const t of a.tags || []) set.add(t)
  return Array.from(set).sort()
})

async function load(tag = '') {
  loading.value = true
  try {
    const params: Record<string, string> = {}
    if (tag) params.tag = tag
    const res = await $fetch<{ articles: Article[] }>('/api/saved-articles', { params })
    articles.value = res.articles
  } catch {
    showError('Could not load the shelf')
  } finally {
    loading.value = false
  }
}

function setTag(t: string) {
  activeTag.value = t
  load(t)
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
