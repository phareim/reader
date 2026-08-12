<template>
  <Teleport to="body">
    <!-- Above HelpOverlay's z-50 — the palette is summoned deliberately and
         should never surface underneath another sheet. -->
    <div
      v-if="open"
      class="fixed inset-0 z-[60] flex justify-center bg-black/30 px-5"
      @click.self="close"
    >
      <CardFrame class="mt-[12dvh] flex h-fit max-h-[60dvh] w-full max-w-lg flex-col">
        <input
          ref="inputEl"
          v-model="q"
          type="text"
          placeholder="Search articles — type > for commands"
          autocapitalize="off"
          autocorrect="off"
          spellcheck="false"
          class="w-full border-0 border-b border-rule bg-transparent px-4 py-3 text-lg text-ink outline-none placeholder:text-mute focus:border-accent"
          @keydown="onInputKey"
        />
        <div v-if="rows.length" class="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <button
            v-for="(row, i) in rows"
            :key="row.key"
            :ref="(el) => setRowEl(i, el)"
            type="button"
            class="pal-row block w-full border-b border-rule px-4 py-2.5 text-left last:border-0"
            :class="{ 'pal-row--selected': i === selected }"
            @mousedown.prevent
            @mousemove="selected = i"
            @click="run(row)"
          >
            <template v-if="row.kind === 'command'">
              <MonoLabel :accent="i === selected" :dash="i === selected">{{ row.label }}</MonoLabel>
            </template>
            <template v-else>
              <div class="flex items-baseline justify-between gap-4">
                <MonoLabel :accent="i === selected" :dash="i === selected" class="min-w-0 truncate">{{ row.feedTitle }}</MonoLabel>
                <MonoLabel class="shrink-0">{{ row.date }}</MonoLabel>
              </div>
              <div class="mt-0.5 truncate text-base leading-snug text-ink">{{ row.label }}</div>
            </template>
          </button>
        </div>
        <p v-else-if="searching" class="px-4 py-3 italic text-mute">Searching…</p>
        <p v-else-if="mode === 'articles' && term.length >= 2 && settled" class="px-4 py-3 italic text-mute">
          Nothing matches “{{ term }}”.
        </p>
      </CardFrame>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { parsePaletteQuery, filterCommands } from '~/utils/palette'
import { formatRelativeDate } from '~/utils/formatDate'

/**
 * The command palette (⌘/Ctrl+Shift+P, keyboard-only — a desktop surface).
 * One centered input, two modes via utils/palette.ts: a leading `>` narrows
 * the command list, anything else full-text-searches articles (the same
 * `GET /api/search` as /search, with its debounce + sequence guard).
 */

interface SearchHit {
  id: number
  feedTitle: string
  title: string
  publishedAt: string | null
}

type Row =
  | { kind: 'command'; key: string; label: string; action: () => void | Promise<void> }
  | { kind: 'article'; key: string; label: string; feedTitle: string; date: string; id: number }

const open = ref(false)
const q = ref('')
const selected = ref(0)
const results = ref<SearchHit[]>([])
const searching = ref(false)
const settled = ref(false)
const inputEl = ref<HTMLInputElement | null>(null)
const rowEls: (HTMLElement | null)[] = []

const { syncAll } = useFeeds()
const { setViewMode } = useViewMode()
const { showSuccess, showError } = useToast()

const parsed = computed(() => parsePaletteQuery(q.value))
const mode = computed(() => parsed.value.mode)
const term = computed(() => parsed.value.term)

const commands: { id: string; label: string; action: () => void | Promise<void> }[] = [
  { id: 'deck', label: 'Go to Deck', action: () => navigateTo('/') },
  { id: 'found', label: 'Go to Found', action: () => navigateTo('/found') },
  { id: 'shelf', label: 'Go to Shelf', action: () => navigateTo('/shelf') },
  { id: 'sources', label: 'Go to Sources', action: () => navigateTo('/sources') },
  { id: 'search', label: 'Go to Search', action: () => navigateTo('/search') },
  { id: 'highlights', label: 'Go to Highlights', action: () => navigateTo('/highlights') },
  { id: 'good-reads', label: 'Go to Good reads', action: () => navigateTo('/good-reads') },
  { id: 'discover', label: 'Go to Discover', action: () => navigateTo('/discover') },
  { id: 'view-deck', label: 'View as Deck', action: () => setViewMode('deck') },
  { id: 'view-grid', label: 'View as Grid', action: () => setViewMode('grid') },
  {
    id: 'sync',
    label: 'Sync all feeds',
    action: async () => {
      try {
        await syncAll()
        showSuccess('Feeds synced')
      } catch {
        showError('Sync failed')
      }
    },
  },
]

const rows = computed<Row[]>(() => {
  if (mode.value === 'commands') {
    return filterCommands(commands, term.value).map((c) => ({
      kind: 'command' as const,
      key: `cmd:${c.id}`,
      label: c.label,
      action: c.action,
    }))
  }
  return results.value.slice(0, 8).map((r) => ({
    kind: 'article' as const,
    key: `art:${r.id}`,
    label: r.title,
    feedTitle: r.feedTitle,
    date: r.publishedAt ? formatRelativeDate(r.publishedAt) : '',
    id: r.id,
  }))
})

watch(rows, () => {
  selected.value = 0
})

// Article search: 250ms debounce, sequence-guarded against out-of-order
// responses — the same discipline as pages/search.vue.
let debounce: ReturnType<typeof setTimeout> | null = null
let seq = 0

watch([mode, term], () => {
  if (debounce) clearTimeout(debounce)
  if (mode.value !== 'articles' || term.value.length < 2) {
    results.value = []
    searching.value = false
    settled.value = false
    return
  }
  debounce = setTimeout(runSearch, 250)
})

async function runSearch() {
  const mySeq = ++seq
  searching.value = true
  try {
    const res = await $fetch<{ results: SearchHit[] }>('/api/search', {
      params: { q: term.value },
    })
    if (mySeq !== seq) return
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

function openPalette() {
  q.value = ''
  results.value = []
  selected.value = 0
  settled.value = false
  open.value = true
  nextTick(() => inputEl.value?.focus())
}

function close() {
  open.value = false
  if (debounce) clearTimeout(debounce)
  seq++ // orphan any in-flight search
}

async function run(row: Row) {
  close()
  if (row.kind === 'article') await navigateTo(`/article/${row.id}`)
  else await row.action()
}

function setRowEl(i: number, el: unknown) {
  rowEls[i] = (el as HTMLElement | null) ?? null
}

function move(delta: number) {
  if (!rows.value.length) return
  selected.value = (selected.value + delta + rows.value.length) % rows.value.length
  rowEls[selected.value]?.scrollIntoView({ block: 'nearest' })
}

function onInputKey(e: KeyboardEvent) {
  if (e.key === 'ArrowDown') { e.preventDefault(); move(1) }
  else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1) }
  else if (e.key === 'Enter') {
    e.preventDefault()
    const row = rows.value[selected.value]
    if (row) run(row)
  } else if (e.key === 'Escape') { e.preventDefault(); close() }
}

// The global chords: ⌘/Ctrl+Shift+P and the ⌘/Ctrl+K alias. Meta/ctrl is
// part of both, so the page handlers' modifier guard already keeps these
// keypresses away from the deck and reader verbs.
function onGlobalKey(e: KeyboardEvent) {
  const chord =
    (e.metaKey || e.ctrlKey) &&
    ((e.shiftKey && (e.key === 'p' || e.key === 'P')) ||
      (!e.shiftKey && e.key === 'k'))
  if (chord) {
    e.preventDefault()
    if (open.value) close()
    else openPalette()
  }
}

onMounted(() => window.addEventListener('keydown', onGlobalKey))
onUnmounted(() => window.removeEventListener('keydown', onGlobalKey))
</script>

<style scoped>
.pal-row {
  background: transparent;
}
.pal-row--selected {
  background: var(--surface-sunk);
}
.pal-row:focus-visible {
  outline: 1px solid var(--tufte-accent);
  outline-offset: -1px;
}
</style>
