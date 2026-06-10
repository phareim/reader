<template>
  <main class="mx-auto max-w-measure px-5 py-6">
    <!-- Action row -->
    <div class="flex items-center justify-between">
      <ActionLabel @click="goBack">Back</ActionLabel>
      <div class="flex gap-2">
        <ActionLabel :accent="saved" @click="toggleSaveAction">{{ saved ? 'Saved' : 'Save' }}</ActionLabel>
        <ActionLabel @click="elevateAction" :disabled="elevating">{{ elevating ? 'Elevating…' : 'Elevate' }}</ActionLabel>
        <ActionLabel @click="openOriginal">Original</ActionLabel>
      </div>
    </div>
    <HairlineRule class="mt-4" />

    <template v-if="article">
      <header class="mt-8">
        <div class="flex items-baseline justify-between">
          <MonoLabel dash>{{ article.feedTitle }}</MonoLabel>
          <MonoLabel>{{ relativeDate }}</MonoLabel>
        </div>
        <h1 class="mt-3 text-3xl leading-tight text-ink">{{ article.title }}</h1>
        <p v-if="article.author" class="mt-2 italic text-mute">{{ article.author }}</p>
      </header>

      <HairlineRule class="my-6" />

      <p v-if="fetchingFullText" class="italic text-mute">Fetching the full article…</p>
      <article class="prose pb-24" v-html="sanitizedContent" />
    </template>

    <p v-else-if="error" class="mt-10 italic text-mute">{{ error }}</p>
    <p v-else class="mt-10 italic text-mute">Loading…</p>
  </main>
</template>

<script setup lang="ts">
import { formatRelativeDate } from '~/utils/formatDate'
import { stripHtml } from '~/utils/cardData'
import { processArticleContent } from '~/utils/processArticleContent'
import { looksLikePlainText } from '~/utils/paragraphize'

const route = useRoute()
const router = useRouter()
const id = Number(route.params.id)

const { isSaved, saveArticle, unsaveArticle, fetchSavedArticleIds } = useSavedArticles()
const { elevate } = useElevate()
const { markAsRead } = useArticles()
const { showSuccess, showError } = useToast()

const article = ref<any>(null)
const error = ref<string | null>(null)
const fetchingFullText = ref(false)
const elevating = ref(false)

const saved = computed(() => isSaved(id))
const relativeDate = computed(() =>
  article.value?.publishedAt ? formatRelativeDate(article.value.publishedAt) : ''
)
const sanitizedContent = computed(() =>
  processArticleContent(article.value?.content) ?? ''
)

/** RSS bodies under ~1200 visible chars are treated as excerpts → fetch full text. */
const THIN_CHARS = 1200

onMounted(async () => {
  fetchSavedArticleIds().catch(() => {})
  try {
    article.value = await $fetch(`/api/articles/${id}`)
  } catch (err: any) {
    error.value = err.statusMessage || 'Could not load the article'
    return
  }

  const content = article.value?.content || ''
  const visible = stripHtml(content)
  if (visible.length < THIN_CHARS) {
    fetchingFullText.value = true
    try {
      await $fetch(`/api/articles/${id}/fetch-fulltext`, { method: 'POST' })
      article.value = await $fetch(`/api/articles/${id}`)
    } catch {
      // Keep the excerpt — "Original" is one tap away.
    } finally {
      fetchingFullText.value = false
    }
  } else if (looksLikePlainText(content) && article.value?.fullTextStatus !== 'failed') {
    // Legacy tag-less full text: silently upgrade the stored copy to rich
    // HTML. The paragraphized version already renders fine meanwhile, and
    // the new pipeline always stores tagged HTML, so this fires once.
    try {
      await $fetch(`/api/articles/${id}/fetch-fulltext`, { method: 'POST' })
      article.value = await $fetch(`/api/articles/${id}`)
    } catch {
      // Keep the paragraphized plain text.
    }
  }
})

function goBack() {
  if (window.history.length > 1) router.back()
  else navigateTo('/')
}

async function toggleSaveAction() {
  try {
    if (saved.value) { await unsaveArticle(id); showSuccess('Removed from shelf') }
    else { await saveArticle(id); showSuccess('On the shelf') }
  } catch { showError('Could not update the shelf') }
}

async function elevateAction() {
  if (elevating.value) return
  elevating.value = true
  try {
    await elevate(id)
    markAsRead(id, true).catch(() => {})
    showSuccess('Elevated to SFL')
  } catch {
    showError('Could not reach SFL')
  } finally {
    elevating.value = false
  }
}

function openOriginal() {
  if (article.value?.url) window.open(article.value.url, '_blank', 'noopener')
}

function onKey(e: KeyboardEvent) {
  if (e.metaKey || e.ctrlKey || e.altKey) return
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
  if (e.target instanceof HTMLElement && e.target.isContentEditable) return
  if (e.key === 'Escape' || e.key === 'Backspace') { e.preventDefault(); goBack() }
  else if (e.key === 's') toggleSaveAction()
  else if (e.key === 'e') elevateAction()
  else if (e.key === 'v') openOriginal()
}
onMounted(() => window.addEventListener('keydown', onKey))
onUnmounted(() => window.removeEventListener('keydown', onKey))
</script>
