<template>
  <main class="mx-auto max-w-measure px-5 py-6 pb-20">
    <header class="flex items-baseline justify-between">
      <MonoLabel dash>Search</MonoLabel>
      <MonoLabel v-if="results.length">{{ results.length }} found</MonoLabel>
    </header>
    <HairlineRule class="mt-3" />

    <input
      ref="inputEl"
      v-model="q"
      type="search"
      placeholder="Search everything you subscribe to…"
      autocapitalize="off"
      autocorrect="off"
      spellcheck="false"
      class="mt-5 w-full border-0 border-b border-rule bg-transparent py-1.5 text-lg text-ink outline-none focus:border-accent"
    />

    <p v-if="searching" class="mt-8 italic text-mute">Searching…</p>
    <p v-else-if="settled && q.trim().length >= 2 && results.length === 0" class="mt-8 italic text-mute">
      Nothing matches “{{ q.trim() }}”.
    </p>

    <ul v-else class="mt-2">
      <li v-for="r in results" :key="r.id" class="border-b border-rule py-4">
        <NuxtLink :to="`/article/${r.id}`" class="block">
          <div class="flex items-baseline justify-between gap-4">
            <MonoLabel dash>{{ r.feedTitle }}</MonoLabel>
            <MonoLabel>{{ r.publishedAt ? formatRelativeDate(r.publishedAt) : '' }}</MonoLabel>
          </div>
          <h2 class="mt-1 text-xl leading-snug text-ink">{{ r.title }}</h2>
          <p
            v-if="r.snippet"
            class="mt-1 text-sm text-mute"
            v-html="renderSnippetHtml(r.snippet)"
          />
        </NuxtLink>
      </li>
    </ul>
  </main>
</template>

<script setup lang="ts">
import { renderSnippetHtml } from '~/utils/searchRender'
import { formatRelativeDate } from '~/utils/formatDate'

interface SearchHit {
  id: number
  feedId: number
  feedTitle: string
  title: string
  url: string | null
  summary: string | null
  imageUrl: string | null
  publishedAt: string | null
  isRead: boolean
  snippet: string
}

const q = ref('')
const results = ref<SearchHit[]>([])
const searching = ref(false)
const settled = ref(false)
const inputEl = ref<HTMLInputElement | null>(null)

let debounce: ReturnType<typeof setTimeout> | null = null
let seq = 0

watch(q, () => {
  if (debounce) clearTimeout(debounce)
  const term = q.value.trim()
  if (term.length < 2) {
    results.value = []
    settled.value = false
    searching.value = false
    return
  }
  debounce = setTimeout(run, 250)
})

async function run() {
  const term = q.value.trim()
  if (term.length < 2) return
  const mySeq = ++seq
  searching.value = true
  try {
    const res = await $fetch<{ results: SearchHit[] }>('/api/search', {
      params: { q: term }
    })
    if (mySeq !== seq) return // a newer keystroke's search is in flight
    results.value = res.results
    settled.value = true
  } catch {
    if (mySeq === seq) {
      results.value = []
      settled.value = true
    }
  } finally {
    if (mySeq === seq) searching.value = false
  }
}

onMounted(() => inputEl.value?.focus())
</script>
