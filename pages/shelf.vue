<template>
  <main class="mx-auto max-w-measure px-5 py-6 pb-20">
    <header class="flex items-center justify-between">
      <MonoLabel dash>Shelf</MonoLabel>
      <!-- Like ActionLabel: on phones the glyph carries each link, from sm: up
           the mono text label takes over. items-center (not baseline) so the
           14px glyphs sit level with the 10px mono labels. -->
      <div class="flex items-center gap-4">
        <NuxtLink to="/search" aria-label="Search" class="focus-visible:outline focus-visible:outline-1">
          <span class="flex text-mute sm:hidden" aria-hidden="true">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.35-4.35" /></svg>
          </span>
          <MonoLabel class="hidden sm:inline">Search</MonoLabel>
        </NuxtLink>
        <NuxtLink to="/highlights" aria-label="Highlights" class="focus-visible:outline focus-visible:outline-1">
          <span class="flex text-mute sm:hidden" aria-hidden="true">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z" /></svg>
          </span>
          <MonoLabel class="hidden sm:inline">Highlights</MonoLabel>
        </NuxtLink>
        <NuxtLink to="/good-reads" aria-label="Good reads" class="focus-visible:outline focus-visible:outline-1">
          <span class="flex text-mute sm:hidden" aria-hidden="true">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l2.9 5.9 6.5.9-4.7 4.6 1.1 6.4L12 17.8l-5.8 3 1.1-6.4L2.6 9.8l6.5-.9z" /></svg>
          </span>
          <MonoLabel class="hidden sm:inline">Good reads</MonoLabel>
        </NuxtLink>
        <MonoLabel>{{ articles.length }} saved</MonoLabel>
      </div>
    </header>
    <HairlineRule class="mt-3" />

    <!-- Continue reading: unread articles with a saved position. Quiet strip
         above the saved list; absent entirely when nothing is in progress. -->
    <section v-if="inProgress.length" class="mt-6">
      <MonoLabel dash>Continue reading</MonoLabel>
      <ul class="mt-1">
        <li v-for="a in inProgress" :key="a.id" class="border-b border-rule py-3">
          <NuxtLink :to="`/article/${a.id}`" class="block">
            <div class="flex items-baseline justify-between gap-4">
              <MonoLabel dash><FeedFavicon :src="a.feedFavicon" class="mr-1" />{{ a.feedTitle }}</MonoLabel>
              <MonoLabel>{{ Math.round((a.readProgress || 0) * 100) }}%</MonoLabel>
            </div>
            <h2 class="mt-1 text-lg leading-snug text-ink">{{ a.title }}</h2>
          </NuxtLink>
        </li>
      </ul>
      <HairlineRule class="mt-6" />
    </section>

    <p v-if="loading" class="mt-8 italic text-mute">Loading…</p>
    <p v-else-if="articles.length === 0" class="mt-8 italic text-mute">
      Nothing on the shelf yet — swipe a card right when something touches you.
    </p>

    <!--
      Each row is horizontally draggable (drag="x") while touch-action: pan-y
      leaves vertical pans to the native page scroll — the grid's gesture
      split. Swipe left = done reading: mark read AND off the shelf, the row
      flings away with an undo. Right has no verb here (the row is already
      saved) and springs back. overflow-x: clip so a flinging row never grows
      the page sideways.
    -->
    <TransitionGroup v-else tag="ul" name="shelf-rows" style="overflow-x: clip;">
      <li v-for="a in articles" :key="a.id" class="border-b border-rule">
        <motion.div
          class="relative py-4"
          style="touch-action: pan-y;"
          :style="{ x: xFor(a.id) }"
          :drag="exiting.has(a.id) ? false : 'x'"
          :drag-elastic="0.9"
          :drag-momentum="false"
          @pointerdown="onPointerDown(a)"
          @drag-start="onDragStart(a)"
          @drag="(e: PointerEvent, info: PanInfo) => onDrag(a, info)"
          @drag-end="(e: PointerEvent, info: PanInfo) => onDragEnd(a, info)"
          @click.capture="onRowClick"
        >
          <NuxtLink :to="`/article/${a.id}`" class="block">
            <div class="flex items-baseline justify-between gap-4">
              <MonoLabel dash><FeedFavicon :src="a.feedFavicon" class="mr-1" />{{ a.feedTitle }}</MonoLabel>
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
          <!-- Pending-verb label: the one accent, on the dragged row only -->
          <div
            v-if="dragId === a.id && pending"
            class="pointer-events-none absolute inset-0 z-10 flex items-center justify-center"
            :style="{ opacity: pendingProgress }"
          >
            <ActionLabel accent>Read</ActionLabel>
          </div>
        </motion.div>
      </li>
    </TransitionGroup>

    <UndoToast :visible="undoVisible" label="Read" @undo="performUndo" />
  </main>
</template>

<script setup lang="ts">
// ref/onMounted/onUnmounted imported explicitly (not relying on Nuxt
// auto-imports) so the page also resolves under Jest. Harmless under Nuxt.
import { ref, onMounted, onUnmounted } from 'vue'
import { motion, motionValue, animate } from 'motion-v'
import type { MotionValue, PanInfo } from 'motion-v'
import type { Article } from '~/types'
import { excerpt } from '~/utils/cardData'
import { formatRelativeDate } from '~/utils/formatDate'
import { GRID, resolveGridDirection } from '~/utils/grid'
import { DECK } from '~/utils/deck'

const { saveArticle, unsaveArticle } = useSavedArticles()
const { markAsRead } = useArticles()
const { showError, showSuccess } = useToast()

const articles = ref<Article[]>([])
const inProgress = ref<Article[]>([])
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

async function loadInProgress() {
  try {
    const res = await $fetch<{ articles: Article[] }>('/api/articles', {
      params: { inProgress: 'true', limit: 8 }
    })
    inProgress.value = res.articles
  } catch {
    inProgress.value = [] // the strip is optional — fail silent
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

/* ── Swipe-left = done reading (mark read + off the shelf) ─────────── */
// Same drag mechanics as ArticleGrid: one MotionValue per row so a
// committing row flings out on its own value while the next swipe starts
// immediately; entries dropped after the commit so an undone row re-enters
// at rest.
const xMap = new Map<number, MotionValue<number>>()
function xFor(id: number): MotionValue<number> {
  let v = xMap.get(id)
  if (!v) {
    v = motionValue(0)
    xMap.set(id, v)
  }
  return v
}

const dragId = ref<number | null>(null)
const pending = ref(false)
const pendingProgress = ref(0)
const exiting = ref<Set<number>>(new Set())
const movedFar = ref(false)

function onPointerDown(article: Article) {
  if (exiting.value.has(article.id)) return
  dragId.value = article.id
  movedFar.value = false
}

function onDragStart(article: Article) {
  if (dragId.value !== article.id) return
  pending.value = false
  pendingProgress.value = 0
}

function onDrag(article: Article, info: PanInfo) {
  if (dragId.value !== article.id) return
  const dx = info.offset.x
  const dy = info.offset.y
  if (Math.abs(dx) > 8) movedFar.value = true
  // Accent mirrors the release rule (diagonal = scroll, never a swipe) and
  // lights only for LEFT — right has no verb on the shelf.
  if (dx < -4 && Math.abs(dx) >= Math.abs(dy) * GRID.DOMINANCE_RATIO) {
    pending.value = true
    pendingProgress.value = Math.min(1, Math.abs(dx) / GRID.DISTANCE_THRESHOLD)
  } else {
    pending.value = false
    pendingProgress.value = 0
  }
}

async function onDragEnd(article: Article, info: PanInfo) {
  if (dragId.value !== article.id) return
  pending.value = false
  pendingProgress.value = 0
  // Defer the tap-guard reset so the click (fired after dragEnd) still sees
  // movedFar=true and the NuxtLink doesn't navigate.
  setTimeout(() => { movedFar.value = false }, 0)
  const dir = resolveGridDirection(info.offset.x, info.offset.y, info.velocity.x)
  if (dir === 'left') {
    await commitRow(article, info.velocity.x)
  } else {
    if (dragId.value === article.id) dragId.value = null
    await settleWithin(animate(xFor(article.id), 0, DECK.SPRING))
  }
}

function onRowClick(e: Event) {
  if (movedFar.value) {
    e.preventDefault()
    e.stopPropagation()
  }
}

// Same safety net as CardStack/ArticleGrid: motion-dom's JSAnimation never
// resolves `finished` when stopped, so a bare await could wedge forever.
const ANIMATION_SAFETY_MS = 1200
function settleWithin(p: Promise<unknown>, ms = ANIMATION_SAFETY_MS): Promise<void> {
  return new Promise((resolve) => {
    const t = setTimeout(resolve, ms)
    p.then(
      () => { clearTimeout(t); resolve() },
      () => { clearTimeout(t); resolve() },
    )
  })
}

/**
 * Fling the row off left, then perform the archive optimistically: mark read
 * (only when it wasn't already — a shelf row can hold an already-read
 * article) and unsave. The history entry keeps the row + its position +
 * prior read state so undo can restore both exactly. Exposed for tests.
 */
async function commitRow(article: Article, vx = 0) {
  if (exiting.value.has(article.id)) return
  exiting.value = new Set(exiting.value).add(article.id)
  if (dragId.value === article.id) dragId.value = null
  try {
    const w = typeof window === 'undefined' ? 800 : window.innerWidth
    await settleWithin(animate(xFor(article.id), -w, { ...GRID.FLING, velocity: vx }))
    const index = articles.value.findIndex((x) => x.id === article.id)
    if (index === -1) return
    articles.value = articles.value.filter((x) => x.id !== article.id)
    if (!article.isRead) markAsRead(article.id, true).catch(() => showError('Mark-read failed'))
    unsaveArticle(article.id).catch(() => showError('Could not take it off the shelf'))
    history.value = [...history.value, { article, index, wasRead: Boolean(article.isRead) }]
    showUndo()
  } finally {
    xMap.delete(article.id)
    const next = new Set(exiting.value)
    next.delete(article.id)
    exiting.value = next
  }
}

/* ── Undo ──────────────────────────────────────────────────────────── */
const history = ref<Array<{ article: Article; index: number; wasRead: boolean }>>([])
const undoVisible = ref(false)
let undoTimer: ReturnType<typeof setTimeout> | null = null

function showUndo() {
  undoVisible.value = true
  if (undoTimer) clearTimeout(undoTimer)
  undoTimer = setTimeout(() => { undoVisible.value = false }, 5000)
}

async function performUndo() {
  undoVisible.value = false
  const entry = history.value[history.value.length - 1]
  if (!entry) return
  history.value = history.value.slice(0, -1)
  const arr = [...articles.value]
  arr.splice(Math.min(entry.index, arr.length), 0, entry.article)
  articles.value = arr
  try {
    await saveArticle(entry.article.id)
    if (!entry.wasRead) await markAsRead(entry.article.id, false)
  } catch {
    showError('Undo could not reach the server')
  }
}

onMounted(() => {
  load()
  loadInProgress()
})

onUnmounted(() => {
  if (undoTimer) clearTimeout(undoTimer)
})

defineExpose({ commitRow, performUndo })
</script>

<style scoped>
.shelf-rows-move {
  transition: transform 0.25s ease;
}
</style>
