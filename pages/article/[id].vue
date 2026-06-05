<template>
  <div class="min-h-screen bg-paper text-ink font-serif">
    <!-- Hamburger Menu -->
    <HamburgerMenu ref="hamburgerMenuRef" />

    <!-- Keyboard Shortcuts Help Dialog -->
    <KeyboardShortcutsHelp ref="helpDialogRef" />

    <!-- Main Content Area -->
    <div
      class="min-h-screen transition-all duration-300 ease-in-out"
      :style="{ marginLeft: menuIsOpen ? '20rem' : '0' }"
    >
      <!-- Sticky Header -->
      <PageHeader
        :menu-is-open="menuIsOpen"
        :current-article="article"
        :selected-feed="selectedFeed"
        :selected-feed-id="article?.feedId || null"
        :selected-tag="null"
        @toggle-menu="toggleMenu"
        @mark-all-read="() => {}"
        @refresh-feed="() => {}"
        @sync-all="handleSyncAll"
        @view-saved="handleViewSaved"
        @sign-out="handleSignOut"
        @success="handleHeaderSuccess"
        @error="handleHeaderError"
      />

      <!-- Loading State -->
      <div v-if="loading" class="flex items-center justify-center py-24">
        <MonoLabel class="text-mute">LOADING</MonoLabel>
      </div>

      <!-- Error State -->
      <div v-else-if="error" class="flex flex-col items-center justify-center py-24 px-6">
        <div class="max-w-[65ch] w-full text-center space-y-6">
          <MonoLabel class="text-rust">NOT FOUND</MonoLabel>
          <SerifHeadline level="h2">Article not found</SerifHeadline>
          <p class="text-mute font-serif text-[14px] leading-[1.55]">{{ error }}</p>
          <div class="flex justify-center pt-2">
            <ActionLabel label="BACK" accent @click="router.push(backUrl)" />
          </div>
        </div>
      </div>

      <!-- Article Content -->
      <article
        v-else-if="article"
        ref="cardRef"
        class="max-w-[65ch] mx-auto px-6 py-10 select-text"
        :style="cardStyle"
        v-on="handlers"
      >
        <!-- Header -->
        <header class="mb-1">
          <MonoLabel class="text-mute">
            <template v-if="article.feedTitle">{{ article.feedTitle }} · </template>{{ formatDate(article.publishedAt) }}
          </MonoLabel>

          <SerifHeadline level="h1" class="mt-4 mb-2">
            {{ article.title }}
          </SerifHeadline>

          <p v-if="article.author" class="mt-2 text-mute font-serif italic text-[13px] leading-[1.5]">
            {{ article.author }}
          </p>
        </header>

        <HeaderDivider />

        <!-- Hero image -->
        <figure v-if="article.imageUrl" class="my-6">
          <img
            :src="article.imageUrl"
            :alt="article.title"
            class="w-full border border-rule"
            loading="lazy"
          />
        </figure>

        <!-- Body -->
        <div class="almanac-prose font-serif text-ink">
          <div v-if="processedContent" v-html="processedContent"></div>
          <p v-else-if="article.summary" class="text-ink">{{ article.summary }}</p>
          <p v-else class="text-mute italic">No content available for this article.</p>
        </div>

        <SectionDivider class="!my-10" />

        <!-- Action footer (hairline) -->
        <footer class="flex flex-wrap items-center gap-3">
          <template v-if="loggedIn">
            <ActionLabel
              :label="isSaved ? 'STORED' : 'STORE'"
              :accent="isSaved"
              @click="commit('left')"
            />
            <ActionLabel
              :label="article.isRead ? 'MARK UNREAD' : 'MARK READ'"
              @click="toggleRead"
            />
          </template>
          <NuxtLink v-else to="/login" class="inline-flex">
            <ActionLabel label="SIGN IN TO SAVE" accent @click="() => {}" />
          </NuxtLink>

          <ActionLabel label="OPEN ORIGINAL" @click="openOriginal" />

          <span class="flex-1"></span>

          <ActionLabel label="BACK" @click="router.push(backUrl)" />
        </footer>

        <!-- Prev / Next navigation (hairline) -->
        <nav
          v-if="prevArticleId || nextArticleId"
          class="mt-8 pt-6 flex items-center justify-between gap-3 border-t border-rule"
        >
          <NuxtLink
            v-if="prevArticleId"
            :to="{ path: `/article/${prevArticleId}`, query: route.query.from ? { from: route.query.from } : {} }"
            class="inline-flex"
          >
            <ActionLabel label="PREV" @click="() => {}" />
          </NuxtLink>
          <span v-else></span>

          <NuxtLink
            v-if="nextArticleId"
            :to="{ path: `/article/${nextArticleId}`, query: route.query.from ? { from: route.query.from } : {} }"
            class="inline-flex"
          >
            <ActionLabel label="NEXT" @click="() => {}" />
          </NuxtLink>
          <span v-else></span>
        </nav>
      </article>
    </div>

    <!-- Swipe Indicator (fixed overlay, independent of content state) -->
    <Transition
      enter-active-class="transition-opacity duration-200"
      leave-active-class="transition-opacity duration-200"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="isSwipeGesture && swipeProgress > 0"
        class="fixed inset-0 pointer-events-none z-50 overflow-hidden"
      >
        <!-- Left side indicator (swipe right -> previous) -->
        <SwipeIndicator
          v-if="swipeDirection === 'right'"
          side="left"
          :progress="swipeProgress"
          :y-percent="swipeYPercent"
          :height="windowHeight || 1000"
          :threshold="swipeThreshold"
          :curve-path="leftCurvePath"
          :fill-path="leftFillPath"
          :can-navigate="!!prevArticleId"
        />

        <!-- Right side indicator (swipe left -> next) -->
        <SwipeIndicator
          v-if="swipeDirection === 'left'"
          side="right"
          :progress="swipeProgress"
          :y-percent="swipeYPercent"
          :height="windowHeight || 1000"
          :threshold="swipeThreshold"
          :curve-path="rightCurvePath"
          :fill-path="rightFillPath"
          :can-navigate="!!nextArticleId"
        />
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { formatRelativeDate } from '~/utils/formatDate'
import { useSwipeGesture } from '~/composables/useSwipeGesture'
import { useDeckGesture } from '~/composables/useDeckGesture'
import { useArticleNavigation } from '~/composables/useArticleNavigation'
import { useToast } from '~/composables/useToast'
import { getSwipeCurve, getSwipeFillPath, getCurveParams } from '~/utils/swipeCurve'
import { processArticleContent } from '~/utils/processArticleContent'
import type { DeckDirection } from '~/utils/deck'

const route = useRoute()
const router = useRouter()
const articleId = computed(() => parseInt(route.params.id as string))

// Track where the user came from for better back navigation
const backUrl = computed(() => {
  const fromParam = route.query.from as string
  if (fromParam) {
    return `/${fromParam}`
  }
  return article.value?.feedId ? `/feed/${article.value.feedId}` : '/'
})

const { loggedIn, signOut } = useAuth()

const {
  feeds,
  fetchFeeds,
  syncAll
} = useFeeds()

const {
  markAsRead,
} = useArticles()

const {
  isSaved: checkSaved,
  toggleSave: toggleSaveAction,
  fetchSavedArticleIds
} = useSavedArticles()

// Local state
const article = ref<any>(null)
const loading = ref(true)
const error = ref<string | null>(null)
const cardRef = ref<HTMLElement | null>(null)

// Article navigation composable
const {
  prevArticleId,
  nextArticleId,
  fetchAdjacentArticles
} = useArticleNavigation({
  currentArticleId: articleId,
  feedId: computed(() => article.value?.feedId)
})

// Reference to hamburger menu
const hamburgerMenuRef = ref<any>(null)
const menuIsOpen = computed(() => hamburgerMenuRef.value?.isOpen ?? false)

// Reference to help dialog
const helpDialogRef = ref<any>(null)

const toggleMenu = () => {
  if (hamburgerMenuRef.value) {
    hamburgerMenuRef.value.isOpen = !hamburgerMenuRef.value.isOpen
  }
}

// Computed properties
const isSaved = computed(() => checkSaved(articleId.value))

const selectedFeed = computed(() => {
  if (!article.value?.feedId) return null
  return feeds.value.find(f => f.id === article.value.feedId) || null
})

// Process article content (sanitize + open links in new tabs)
const processedContent = computed(() => processArticleContent(article.value?.content))

// SEO meta tags
watch(article, (newArticle) => {
  if (newArticle) {
    useSeoMeta({
      title: newArticle.title,
      description: newArticle.summary || `Read "${newArticle.title}" on The Librarian`,
      ogTitle: newArticle.title,
      ogDescription: newArticle.summary || `Read "${newArticle.title}" on The Librarian`,
      ogType: 'article',
      ogUrl: `${window.location.origin}/article/${newArticle.id}`,
      ogImage: newArticle.imageUrl || newArticle.feedFaviconUrl,
      twitterCard: 'summary_large_image',
      twitterTitle: newArticle.title,
      twitterDescription: newArticle.summary || `Read "${newArticle.title}" on The Librarian`,
      twitterImage: newArticle.imageUrl || newArticle.feedFaviconUrl,
    })
  }
}, { immediate: true })

// Fetch article data
const fetchArticle = async () => {
  loading.value = true
  error.value = null

  try {
    const response = await $fetch(`/api/articles/${articleId.value}`)
    article.value = response

    if (!article.value.isRead) {
      await markAsRead(articleId.value, true)
      article.value.isRead = true
    }

    await fetchAdjacentArticles()
  } catch (e: any) {
    console.error('Failed to fetch article:', e)
    error.value = e.statusMessage || 'Failed to load article'
  } finally {
    loading.value = false
  }
}

// Toast notifications
const { showSuccess, showError } = useToast()

// Actions
const openOriginal = () => {
  if (article.value?.url) {
    window.open(article.value.url, '_blank', 'noopener,noreferrer')
  }
}

const toggleSave = async () => {
  if (!loggedIn.value) {
    navigateTo('/login')
    return
  }
  try {
    const wasSaved = isSaved.value
    await toggleSaveAction(articleId.value)
    showSuccess(wasSaved ? 'Removed from saved' : 'Saved for later')
  } catch (e) {
    console.error('Failed to toggle save:', e)
    showError('Could not update saved state')
  }
}

const toggleRead = async () => {
  try {
    const next = !article.value.isRead
    await markAsRead(articleId.value, next)
    article.value.isRead = next
    showSuccess(next ? 'Marked read' : 'Marked unread')
  } catch (e) {
    console.error('Failed to toggle read:', e)
    showError('Could not update read state')
  }
}

const handleSyncAll = async () => {
  try {
    await syncAll()
  } catch (e) {
    console.error('Failed to sync all:', e)
  }
}

const handleViewSaved = () => {
  router.push('/saved')
}

const handleSignOut = async () => {
  await signOut()
  navigateTo('/login')
}

const handleHeaderSuccess = (message: string) => showSuccess(message)
const handleHeaderError = (message: string) => showError(message)

const formatDate = formatRelativeDate

// ---- Deck gesture (single-card reader) --------------------------------
// Maps the four Almanac deck directions onto the reader's actions:
//   left  → store  (save/unsave)
//   right → read   (mark read/unread)
//   up    → open   (original URL)
//   down  → skip   (back to the list)
const onDeckCommit = (dir: DeckDirection) => {
  switch (dir) {
    case 'left':
      toggleSave()
      break
    case 'right':
      toggleRead()
      break
    case 'up':
      openOriginal()
      break
    case 'down':
      router.push(backUrl.value)
      break
  }
}

const { cardStyle, handlers, commit } = useDeckGesture({
  onCommit: onDeckCommit,
})

// ---- Prev/next swipe navigation (window-level, restyled) ----------------
const {
  isSwipeGesture,
  swipeProgress,
  swipeDirection,
  swipeYPercent,
  windowHeight,
  swipeThreshold
} = useSwipeGesture({
  onSwipeLeft: () => {
    if (nextArticleId.value) {
      const query = route.query.from ? { from: route.query.from } : {}
      router.push({ path: `/article/${nextArticleId.value}`, query })
    }
  },
  onSwipeRight: () => {
    if (prevArticleId.value) {
      const query = route.query.from ? { from: route.query.from } : {}
      router.push({ path: `/article/${prevArticleId.value}`, query })
    }
  },
  canSwipeLeft: computed(() => !!nextArticleId.value),
  canSwipeRight: computed(() => !!prevArticleId.value)
})

// Computed curve paths for swipe indicators
const curveParams = computed(() =>
  getCurveParams(windowHeight.value || 1000, swipeYPercent.value, swipeProgress.value)
)

const leftCurvePath = computed(() => getSwipeCurve('left', curveParams.value))
const leftFillPath = computed(() => getSwipeFillPath('left', curveParams.value))
const rightCurvePath = computed(() => getSwipeCurve('right', curveParams.value))
const rightFillPath = computed(() => getSwipeFillPath('right', curveParams.value))

// Lifecycle
onMounted(async () => {
  window.addEventListener('keydown', handleArticleKeydown)

  if (loggedIn.value) {
    await Promise.all([
      fetchFeeds(),
      fetchSavedArticleIds(),
      fetchArticle()
    ])
  } else {
    await fetchArticle()
  }
})

// Watch for route changes (next/prev navigation)
watch(() => route.params.id, async () => {
  if (route.params.id) {
    await fetchArticle()
  }
})

// Keyboard shortcut handlers for article view
const articleKeyboardHandlers: Record<string, (e: KeyboardEvent) => void> = {
  'Escape': () => router.push(backUrl.value),
  'o': () => openOriginal(),
  's': () => toggleSave(),
  'm': () => toggleRead(),
  'j': () => {
    if (nextArticleId.value) {
      const query = route.query.from ? { from: route.query.from } : {}
      router.push({ path: `/article/${nextArticleId.value}`, query })
    }
  },
  'k': () => {
    if (prevArticleId.value) {
      const query = route.query.from ? { from: route.query.from } : {}
      router.push({ path: `/article/${prevArticleId.value}`, query })
    }
  }
}

const handleArticleKeydown = (e: KeyboardEvent) => {
  const target = e.target as HTMLElement
  if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
    return
  }

  const handler = articleKeyboardHandlers[e.key]
  if (handler) {
    e.preventDefault()
    handler(e)
  }
}

onUnmounted(() => {
  window.removeEventListener('keydown', handleArticleKeydown)
})
</script>

<style scoped>
/* Almanac prose — serif, hairline rules, rust links, hairline blockquote rule.
   Scoped + :deep() because article body is injected via v-html. */
.almanac-prose {
  font-size: 14px;
  line-height: 1.7;
  max-width: 65ch;
}

.almanac-prose :deep(p) {
  margin: 0 0 1.1em;
}

.almanac-prose :deep(h1),
.almanac-prose :deep(h2),
.almanac-prose :deep(h3),
.almanac-prose :deep(h4),
.almanac-prose :deep(h5),
.almanac-prose :deep(h6) {
  font-weight: 500;
  letter-spacing: -0.012em;
  margin: 1.6em 0 0.5em;
  line-height: 1.25;
}

.almanac-prose :deep(h1) { font-size: 24px; }
.almanac-prose :deep(h2) { font-size: 20px; }
.almanac-prose :deep(h3) { font-size: 17px; }

.almanac-prose :deep(a) {
  color: var(--almanac-accent);
  text-decoration: underline;
  text-decoration-thickness: 1px;
  text-underline-offset: 2px;
}

.almanac-prose :deep(a:hover) {
  text-decoration-thickness: 2px;
}

.almanac-prose :deep(strong) {
  font-weight: 600;
  color: var(--almanac-fg);
}

.almanac-prose :deep(em) {
  font-style: italic;
}

.almanac-prose :deep(ul),
.almanac-prose :deep(ol) {
  margin: 0 0 1.1em;
  padding-left: 1.4em;
}

.almanac-prose :deep(li) {
  margin: 0.3em 0;
}

.almanac-prose :deep(blockquote) {
  margin: 1.4em 0;
  padding-left: 1.1em;
  border-left: 1px solid var(--almanac-rule);
  color: var(--almanac-fg-mute);
  font-style: italic;
}

.almanac-prose :deep(hr) {
  border: 0;
  height: 1px;
  background: var(--almanac-rule);
  margin: 2em 0;
}

.almanac-prose :deep(img),
.almanac-prose :deep(figure) {
  max-width: 100%;
  height: auto;
  margin: 1.4em 0;
}

.almanac-prose :deep(img) {
  border: 1px solid var(--almanac-rule);
}

.almanac-prose :deep(figcaption) {
  font-size: 12px;
  color: var(--almanac-fg-mute);
  margin-top: 0.4em;
  font-style: italic;
}

.almanac-prose :deep(code) {
  font-family: var(--almanac-mono, ui-monospace, SFMono-Regular, monospace);
  font-size: 0.88em;
  background: transparent;
  border: 1px solid var(--almanac-rule);
  padding: 0.05em 0.35em;
}

.almanac-prose :deep(pre) {
  font-family: var(--almanac-mono, ui-monospace, SFMono-Regular, monospace);
  font-size: 12px;
  line-height: 1.5;
  border: 1px solid var(--almanac-rule);
  padding: 1em;
  overflow-x: auto;
  margin: 1.4em 0;
}

.almanac-prose :deep(pre code) {
  border: 0;
  padding: 0;
}

.almanac-prose :deep(table) {
  border-collapse: collapse;
  width: 100%;
  margin: 1.4em 0;
  font-size: 13px;
}

.almanac-prose :deep(th),
.almanac-prose :deep(td) {
  border: 1px solid var(--almanac-rule);
  padding: 0.4em 0.6em;
  text-align: left;
}
</style>
