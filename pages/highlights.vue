<template>
  <main class="fixed inset-0 overflow-y-auto overscroll-none">
    <div class="mx-auto max-w-measure px-5 py-6 pb-20">
      <header class="flex items-baseline justify-between">
        <MonoLabel dash>Highlights</MonoLabel>
        <MonoLabel>{{ headerCount }}</MonoLabel>
      </header>
      <HairlineRule class="mt-3" />

      <!-- Hashtag filter — derived from #tags in the notes; one active at a time -->
      <div v-if="allTags.length" class="mt-4 flex flex-wrap gap-x-4 gap-y-1.5">
        <button
          v-for="t in allTags"
          :key="t"
          class="tag-chip"
          :class="{ 'tag-chip-active': t === activeTag }"
          @click="toggleTag(t)"
        >#{{ t }}</button>
      </div>

      <p v-if="loading" class="mt-8 italic text-mute">Loading…</p>
      <p v-else-if="highlights.length === 0" class="mt-8 italic text-mute">
        Nothing marked yet — select a passage in the reader and press <span class="font-mono">h</span>.
      </p>
      <p v-else-if="filtered.length === 0" class="mt-8 italic text-mute">
        No marks tagged #{{ activeTag }}.
      </p>

      <ul v-else>
        <li v-for="hl in filtered" :key="hl.id" class="border-b border-rule py-5">
          <p class="text-lg leading-relaxed text-ink">
            <span class="quote-wash">{{ hl.quote }}</span>
          </p>
          <p
            v-if="hl.note"
            class="mt-2 text-sm text-body"
            v-html="renderNoteHtml(hl.note)"
          />
          <div class="mt-2.5 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <NuxtLink
              :to="`/article/${hl.articleId}`"
              class="min-w-0 truncate focus-visible:outline focus-visible:outline-1"
            ><MonoLabel dash>{{ hl.articleTitle }}</MonoLabel></NuxtLink>
            <div class="flex items-baseline gap-4">
              <MonoLabel v-if="hl.sflIdeaId">In SFL</MonoLabel>
              <MonoLabel>{{ hl.createdAt ? formatRelativeDate(hl.createdAt) : '' }}</MonoLabel>
              <button class="hl-remove" @click="remove(hl.id)">&mdash; Remove</button>
            </div>
          </div>
        </li>
      </ul>
    </div>
  </main>
</template>

<script setup lang="ts">
import { extractHashtags, renderNoteHtml } from '~/utils/hashtags'
import { formatRelativeDate } from '~/utils/formatDate'

interface HighlightRow {
  id: number
  articleId: number
  articleTitle: string
  articleUrl: string | null
  feedTitle: string
  sflIdeaId: string | null
  quote: string
  note: string | null
  createdAt: string | null
}

const { deleteHighlight } = useHighlights()
const { showSuccess, showError } = useToast()

const highlights = ref<HighlightRow[]>([])
const loading = ref(true)
const activeTag = ref<string | null>(null)

const allTags = computed(() => {
  // Array.from, not [...set] — vue3-jest transpiles SFC scripts with a
  // downlevel target where a Set spread silently yields [].
  const tags = new Set<string>()
  for (const hl of highlights.value) {
    for (const t of extractHashtags(hl.note || '')) tags.add(t)
  }
  return Array.from(tags).sort()
})

const filtered = computed(() => {
  if (!activeTag.value) return highlights.value
  return highlights.value.filter((hl) =>
    extractHashtags(hl.note || '').includes(activeTag.value!)
  )
})

const headerCount = computed(() =>
  activeTag.value
    ? `${filtered.value.length} · #${activeTag.value}`
    : `${highlights.value.length} marked`
)

function toggleTag(t: string) {
  activeTag.value = activeTag.value === t ? null : t
}

async function load() {
  loading.value = true
  try {
    const res = await $fetch<{ highlights: HighlightRow[] }>('/api/highlights')
    highlights.value = res.highlights
  } catch {
    showError('Could not load highlights')
  } finally {
    loading.value = false
  }
}

async function remove(id: number) {
  try {
    await deleteHighlight(id)
    highlights.value = highlights.value.filter((hl) => hl.id !== id)
    showSuccess('Highlight removed')
  } catch {
    showError('Could not remove')
  }
}

onMounted(() => load())
</script>

<style scoped>
/* The saved-passage yellow — the same pen as mark.hl in the reader. */
.quote-wash {
  background-color: var(--highlight);
  box-decoration-break: clone;
  -webkit-box-decoration-break: clone;
  padding: 0.05em 0.15em;
}
.tag-chip {
  font-family: 'SF Mono', ui-monospace, Menlo, monospace;
  font-size: 10px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--text-muted);
}
.tag-chip:hover { color: var(--text-strong); }
.tag-chip:focus-visible { outline: 1px solid var(--tufte-accent); }
.tag-chip-active {
  color: var(--tufte-accent);
  border-bottom: 1px solid var(--tufte-accent);
}
.hl-remove {
  font-family: 'SF Mono', ui-monospace, Menlo, monospace;
  font-size: 10px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--text-muted);
}
.hl-remove:hover { color: var(--text-strong); }
.hl-remove:focus-visible { outline: 1px solid var(--tufte-accent); }
</style>
