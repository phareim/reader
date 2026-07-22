<template>
  <main class="fixed inset-0 overflow-y-auto overscroll-none">
    <div class="mx-auto max-w-measure px-5 py-6 pb-20">
      <header class="flex items-baseline justify-between">
        <MonoLabel dash>Good reads</MonoLabel>
        <MonoLabel>{{ articles.length }} starred</MonoLabel>
      </header>
      <HairlineRule class="mt-3" />

      <p v-if="loading" class="mt-8 italic text-mute">Loading…</p>
      <p v-else-if="articles.length === 0" class="mt-8 italic text-mute">
        Nothing starred yet — mark a good read at the end of an article.
      </p>

      <ul v-else>
        <li v-for="a in articles" :key="a.id" class="border-b border-rule py-4">
          <NuxtLink :to="`/article/${a.id}`" class="block">
            <div class="flex items-baseline justify-between gap-4">
              <MonoLabel dash>{{ a.feedTitle }}</MonoLabel>
              <MonoLabel>{{ a.goodReadAt ? formatRelativeDate(a.goodReadAt) : '' }}</MonoLabel>
            </div>
            <h2 class="mt-1 text-xl leading-snug text-ink">{{ a.title }}</h2>
            <p class="mt-1 text-sm text-mute">{{ excerpt(a.summary, 140) }}</p>
          </NuxtLink>
          <div class="mt-2 flex justify-end">
            <button
              class="gr-remove"
              @click="remove(a.id)"
            >&mdash; Remove</button>
          </div>
        </li>
      </ul>
    </div>
  </main>
</template>

<script setup lang="ts">
import { excerpt } from '~/utils/cardData'
import { formatRelativeDate } from '~/utils/formatDate'

interface GoodReadRow {
  id: number
  feedId: number
  feedTitle: string
  title: string
  url: string | null
  summary: string | null
  goodReadAt: string | null
}

const { unmarkGoodRead } = useGoodReads()
const { showError, showSuccess } = useToast()

const articles = ref<GoodReadRow[]>([])
const loading = ref(true)

async function load() {
  loading.value = true
  try {
    const res = await $fetch<{ articles: GoodReadRow[] }>('/api/good-reads')
    articles.value = res.articles
  } catch {
    showError('Could not load good reads')
  } finally {
    loading.value = false
  }
}

async function remove(id: number) {
  try {
    await unmarkGoodRead(id)
    articles.value = articles.value.filter((a) => a.id !== id)
    showSuccess('Good-read mark removed')
  } catch {
    showError('Could not remove')
  }
}

onMounted(() => load())
</script>

<style scoped>
.gr-remove {
  font-family: 'SF Mono', ui-monospace, Menlo, monospace;
  font-size: 10px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--text-muted);
}
.gr-remove:hover { color: var(--text-strong); }
.gr-remove:focus-visible { outline: 1px solid var(--tufte-accent); }
</style>
