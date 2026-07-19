<template>
  <main class="mx-auto max-w-measure px-5 py-6 pb-20">
    <header class="flex items-baseline justify-between">
      <MonoLabel dash>Discover</MonoLabel>
      <MonoLabel>{{ rows.length ? `${rows.length} recommended` : '' }}</MonoLabel>
    </header>
    <HairlineRule class="mt-3" />
    <p class="mt-3 text-sm italic text-mute">Blogs your sources link to.</p>

    <p v-if="loading" class="mt-8 italic text-mute">Loading…</p>
    <div v-else-if="rows.length === 0" class="mt-8">
      <p class="italic text-mute">
        Nothing new yet — the crawl visits your sources' blogrolls a few times a day.
      </p>
      <ActionLabel class="mt-5" :disabled="refreshing" @click="lookNow">
        {{ refreshing ? 'Looking…' : 'Look now' }}
      </ActionLabel>
    </div>

    <TransitionGroup v-else tag="ul" name="disc">
      <li v-for="row in rows" :key="row.id" class="border-b border-rule py-5">
        <div class="flex items-baseline justify-between gap-4">
          <a
            v-if="row.siteUrl || row.feedUrl"
            :href="row.siteUrl || row.feedUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="min-w-0 text-lg text-ink focus-visible:outline focus-visible:outline-1"
          >{{ row.title }}</a>
          <span v-else class="min-w-0 text-lg text-ink">{{ row.title }}</span>
          <MonoLabel class="shrink-0">{{ row.siteHost }}</MonoLabel>
        </div>
        <p class="mt-1.5"><MonoLabel dash>{{ viaLine(row) }}</MonoLabel></p>
        <p v-if="row.description" class="description mt-2 text-sm text-mute">{{ row.description }}</p>
        <p v-if="quietNote(row)" class="mt-1.5 text-sm italic text-mute">{{ quietNote(row) }}</p>
        <div class="mt-3 flex items-baseline gap-5">
          <MonoLabel v-if="added[row.id]" dash>Added</MonoLabel>
          <ActionLabel v-else accent :disabled="busy[row.id]" @click="add(row)">
            {{ busy[row.id] ? 'Adding…' : 'Add' }}
          </ActionLabel>
          <button v-if="!added[row.id]" class="disc-dismiss" @click="dismiss(row)">&mdash; Dismiss</button>
        </div>
      </li>
    </TransitionGroup>
  </main>
</template>

<script setup lang="ts">
import { formatDistance } from 'date-fns'
import { QUIET_DAYS } from '~/utils/feedHealth'

interface DiscoverRow {
  id: number
  title: string
  siteUrl: string | null
  siteHost: string
  feedUrl: string
  description: string | null
  newestArticleAt: string | null
  viaCount: number
  viaTitles: string[]
}

const { showSuccess, showError } = useToast()

const rows = ref<DiscoverRow[]>([])
const loading = ref(true)
const refreshing = ref(false)
// Plain objects, not Sets — Vue tracks them and vue3-jest's downlevel
// target makes Set spreads hazardous (see highlights.vue). Busy state is
// per-row so a slow add never blocks adding the next candidate.
const busy = ref<Record<number, boolean>>({})
const added = ref<Record<number, boolean>>({})

function viaLine(row: DiscoverRow): string {
  const names = row.viaTitles.slice(0, 3).join(', ')
  const more = row.viaTitles.length > 3 ? '…' : ''
  return `via ${row.viaCount} ${row.viaCount === 1 ? 'source' : 'sources'} — ${names}${more}`
}

function quietNote(row: DiscoverRow): string | null {
  if (!row.newestArticleAt) return null
  const newest = new Date(row.newestArticleAt)
  const ageDays = (Date.now() - newest.getTime()) / 86_400_000
  if (!Number.isFinite(ageDays) || ageDays <= QUIET_DAYS) return null
  return `quiet — last article ${formatDistance(newest, new Date(), { addSuffix: true })}`
}

async function load() {
  loading.value = true
  try {
    const res = await $fetch<{ candidates: DiscoverRow[] }>('/api/discover')
    rows.value = res.candidates
  } catch {
    showError('Could not load recommendations')
  } finally {
    loading.value = false
  }
}

async function add(row: DiscoverRow) {
  if (busy.value[row.id]) return
  busy.value = { ...busy.value, [row.id]: true }
  try {
    const res = await $fetch<{ feed: { title: string }; articlesAdded: number }>(
      `/api/discover/${row.id}/subscribe`,
      { method: 'POST' }
    )
    added.value = { ...added.value, [row.id]: true }
    showSuccess(`Added ${res.feed.title}${res.articlesAdded ? ` — ${res.articlesAdded} articles` : ''}`)
  } catch {
    showError('Could not add — the feed did not respond')
  } finally {
    busy.value = { ...busy.value, [row.id]: false }
  }
}

async function dismiss(row: DiscoverRow) {
  const index = rows.value.findIndex((r) => r.id === row.id)
  if (index === -1) return
  rows.value = rows.value.filter((r) => r.id !== row.id)
  try {
    await $fetch(`/api/discover/${row.id}/dismiss`, { method: 'POST' })
  } catch {
    const restored = [...rows.value]
    restored.splice(index, 0, row)
    rows.value = restored
    showError('Could not dismiss')
  }
}

async function lookNow() {
  if (refreshing.value) return
  refreshing.value = true
  try {
    await $fetch('/api/discover/refresh', { method: 'POST' })
    await load()
  } catch {
    showError('Could not reach the crawler')
  } finally {
    refreshing.value = false
  }
}

onMounted(() => load())
</script>

<style scoped>
.description {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.disc-dismiss {
  font-family: 'SF Mono', ui-monospace, Menlo, monospace;
  font-size: 10px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--text-muted);
}
.disc-dismiss:hover { color: var(--text-strong); }
.disc-dismiss:focus-visible { outline: 1px solid var(--tufte-accent); }
.disc-leave-active { transition: opacity 0.15s ease; }
.disc-leave-to { opacity: 0; }
</style>
