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
        :current-article="null"
        :selected-feed="null"
        :selected-feed-id="null"
        :selected-tag="tagName"
        :is-loading="articlesLoading"
        :unread-count="unreadArticles.length"
        @toggle-menu="toggleMenu"
        @mark-all-read="markAllReadHandler"
        @refresh-feed="handleRefreshTag"
        @sync-all="handleSyncAll"
        @view-saved="handleViewSaved"
        @sign-out="handleSignOut"
        @success="handleHeaderSuccess"
        @error="handleHeaderError"
      />

      <!-- Reading Column -->
      <div class="mx-auto max-w-2xl px-almanac-gutter py-almanac-gutter">
        <!-- Success/Error Messages -->
        <div v-if="headerSuccess || headerError" class="mb-4">
          <p v-if="headerSuccess" class="mono-label text-rust">{{ headerSuccess }}</p>
          <p v-if="headerError" class="mono-label text-mute">{{ headerError }}</p>
        </div>

        <!-- Loading Skeletons -->
        <div v-if="articlesLoading" class="divide-y divide-rule">
          <ArticleCardSkeleton v-for="i in 8" :key="i" />
        </div>

        <!-- AI Summary Section -->
        <div v-if="!articlesLoading && unreadArticles.length > 0" class="mb-8">
          <!-- Generate Action -->
          <ActionLabel
            v-if="!summaryLoading && !summaryText"
            label="GENERATE AI SUMMARY"
            @click="generateSummary"
          />

          <!-- Loading State -->
          <div v-if="summaryLoading" class="space-y-2 animate-pulse">
            <div class="h-3 bg-rule w-3/4"></div>
            <div class="h-3 bg-rule w-full"></div>
            <div class="h-3 bg-rule w-5/6"></div>
            <div class="h-3 bg-rule w-2/3"></div>
            <p class="mono-label text-mute pt-2">GENERATING SUMMARY</p>
          </div>

          <!-- Summary Display -->
          <PaperPanel v-if="summaryText && !summaryLoading">
            <MonoLabel class="block mb-3 text-rust">AI SUMMARY</MonoLabel>
            <div
              class="font-serif text-[14px] leading-[1.55] text-ink max-w-almanac-measure summary-content"
              v-html="renderedSummary"
            />
            <SectionDivider />
            <div class="flex flex-wrap items-center gap-3">
              <ActionLabel
                :label="`READ ALL ${summaryArticleIds.length}`"
                accent
                @click="markSummarizedAsRead"
              />
              <ActionLabel label="DISMISS" @click="dismissSummary" />
            </div>
          </PaperPanel>

          <!-- Error State -->
          <div v-if="summaryError && !summaryLoading" class="flex items-center gap-3">
            <p class="font-serif text-[14px] text-mute flex-1">{{ summaryError }}</p>
            <ActionLabel label="RETRY" @click="generateSummary" />
          </div>
        </div>

        <!-- Article Reading Column Grouped by Feed -->
        <div v-if="!articlesLoading && searchedArticles.length > 0" class="space-y-10">
          <section v-for="group in articlesByFeed" :key="group.feed.id">
            <!-- Feed Header -->
            <div class="flex items-baseline gap-2 mb-1">
              <MonoLabel>{{ group.feed.title }}</MonoLabel>
              <span class="font-serif text-[12px] text-mute">
                {{ group.articles.length }} article{{ group.articles.length !== 1 ? 's' : '' }}
              </span>
              <button
                @click="handleMarkFeedAsRead(group.feed.id, group.articles)"
                class="ml-auto mono-label text-mute hover:text-rust transition-colors"
                title="Mark all articles in this feed as read"
              >MARK READ</button>
            </div>
            <HeaderDivider />

            <!-- Articles for this feed -->
            <template v-for="(article, index) in group.articles" :key="article.id">
              <SectionDivider v-if="index > 0" />
              <LazyArticleCard
                :article="article"
                :is-selected="selectedArticleId === article.id"
                :is-saved="isSaved(article.id)"
                :show-feed-title="false"
                :all-tags-with-counts="allTagsWithCounts"
                :selection-mode="selectionMode"
                :is-selected-for-bulk="isSelected(article.id)"
                :source-context="`tag/${tagName}`"
                @toggle-save="toggleSaveArticle(article.id)"
                @toggle-read="handleToggleRead(article.id)"
                @update-tags="handleUpdateTags"
                @toggle-selection="handleToggleSelection(article.id, $event)"
              />
            </template>
          </section>
        </div>

        <!-- Empty State -->
        <div v-if="!articlesLoading && searchedArticles.length === 0" class="flex flex-col items-center justify-center py-24 text-center">
          <OrbitalGlyph :size="56" class="mb-6" />
          <SerifHeadline level="h2" class="mb-2">Nothing in #{{ tagName }}</SerifHeadline>
          <p class="font-serif text-[14px] text-mute mb-8 max-w-almanac-measure">
            There are no unread articles tagged with "{{ tagName }}".
          </p>

          <!-- Tag Statistics -->
          <div class="w-full max-w-sm text-left">
            <MonoLabel class="block mb-3">TAG STATISTICS</MonoLabel>
            <SectionDivider />
            <div class="flex items-baseline justify-between py-2">
              <span class="font-serif text-[14px] text-mute">Feeds in tag</span>
              <span class="font-serif text-[18px] text-ink">{{ selectedTagFeedIds.length }}</span>
            </div>
            <SectionDivider />
            <div class="flex items-baseline justify-between py-2">
              <span class="font-serif text-[14px] text-mute">Total articles</span>
              <span class="font-serif text-[18px] text-ink">{{ articles.length }}</span>
            </div>
            <SectionDivider />
            <div class="flex items-baseline justify-between py-2">
              <span class="font-serif text-[14px] text-mute">Unread</span>
              <span class="font-serif text-[18px] text-ink">{{ unreadArticles.length }}</span>
            </div>
            <SectionDivider />
            <div class="flex items-baseline justify-between py-2">
              <span class="font-serif text-[14px] text-mute">Read</span>
              <span class="font-serif text-[18px] text-ink">{{ articles.length - unreadArticles.length }}</span>
            </div>
          </div>

          <div class="flex flex-wrap gap-3 justify-center mt-8">
            <ActionLabel label="REFRESH TAG" @click="handleRefreshTag" />
            <NuxtLink to="/">
              <ActionLabel label="ALL ARTICLES" />
            </NuxtLink>
          </div>
        </div>

        <!-- Bulk Selection Trigger -->
        <div
          v-if="searchedArticles.length > 0 && !selectionMode"
          class="fixed bottom-6 right-6 z-20"
        >
          <ActionLabel label="SELECT" @click="toggleSelectionMode" />
        </div>

        <!-- Bulk Action Bar -->
        <BulkActionBar
          :selected-count="selectedCount"
          @mark-read="handleBulkMarkRead"
          @save="handleBulkSave"
          @clear="handleBulkClear"
          @exit="handleBulkExit"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useKeyboardShortcuts } from '~/composables/useKeyboardShortcuts'
import { marked } from 'marked'
import DOMPurify from 'isomorphic-dompurify'

definePageMeta({
  middleware: 'auth'
})

const route = useRoute()
const router = useRouter()
const tagName = computed(() => route.params.name as string)

const {
  feeds,
  selectedTag,
  selectedTagFeedIds,
  fetchFeeds,
  syncAll,
  refreshFeed
} = useFeeds()

const {
  articles,
  selectedArticleId,
  displayedArticles,
  unreadArticles,
  loading: articlesLoading,
  fetchArticles,
  markAsRead,
  markAllAsRead,
  clearArticles
} = useArticles()

const {
  isSaved,
  fetchSavedArticleIds
} = useSavedArticles()

const {
  allTagsWithCounts,
  fetchTags
} = useTags()

const {
  fetchSavedArticlesByTag
} = useSavedArticlesByTag()

// Use shared article handlers
const {
  toggleSaveArticle,
  handleToggleRead,
  handleUpdateTags,
  handleMarkAsRead,
  handleMarkAllRead: markAllReadHandler
} = useArticleViewHandlers()

// Search functionality
const { searchQuery, filterArticles } = useArticleSearch()

// Apply search filter to displayed articles
const searchedArticles = computed(() => {
  return filterArticles(displayedArticles.value, searchQuery.value)
})

// Common page functionality (menu, auth, etc.)
const {
  hamburgerMenuRef,
  helpDialogRef,
  menuIsOpen,
  toggleMenu,
  handleSyncAll,
  handleSignOut,
  initializeArticlePage
} = useArticlePageCommon()

// Header messages
const {
  success: headerSuccess,
  error: headerError,
  showSuccess: handleHeaderSuccess,
  showError: handleHeaderError
} = useToast()

// Bulk action handlers
const {
  selectionMode,
  selectedArticleIds,
  selectedCount,
  toggleSelectionMode,
  handleToggleSelection,
  handleBulkMarkRead,
  handleBulkSave,
  handleBulkClear,
  handleBulkExit
} = useBulkActionHandlers({
  searchedArticles,
  showSuccess: handleHeaderSuccess,
  showError: handleHeaderError
})

const { isSelected, toggleSelection } = useBulkSelection()

// AI Summary state
const summaryLoading = ref(false)
const summaryText = ref('')
const summaryError = ref('')
const summaryArticleIds = ref<number[]>([])

const renderedSummary = computed(() => {
  if (!summaryText.value) return ''
  try {
    const html = marked.parse(summaryText.value, { breaks: true, gfm: true })
    return DOMPurify.sanitize(html as string, { ADD_ATTR: ['target', 'rel'] })
  } catch {
    return '<p class="text-rust">Error rendering summary</p>'
  }
})

const generateSummary = async () => {
  summaryLoading.value = true
  summaryError.value = ''
  summaryText.value = ''
  summaryArticleIds.value = []

  try {
    const { data, error } = await useFetch(`/api/tags/${encodeURIComponent(tagName.value)}/summary`, {
      method: 'POST',
      body: { limit: 20 }
    })

    if (error.value) {
      summaryError.value = error.value.data?.message || 'Failed to generate summary'
      return
    }

    const result = data.value as any
    if (!result?.success) {
      summaryError.value = result?.error || 'Failed to generate summary'
      return
    }

    summaryText.value = result.summary
    summaryArticleIds.value = result.articleIds || []
  } catch (err: any) {
    summaryError.value = err.message || 'Failed to generate summary'
  } finally {
    summaryLoading.value = false
  }
}

const markSummarizedAsRead = async () => {
  if (summaryArticleIds.value.length === 0) return

  try {
    await $fetch('/api/articles/mark-all-read', {
      method: 'POST',
      body: { articleIds: summaryArticleIds.value }
    })

    // Update local state
    summaryArticleIds.value.forEach(id => {
      markAsRead(id, true)
    })

    handleHeaderSuccess(`Marked ${summaryArticleIds.value.length} articles as read`)
    dismissSummary()
  } catch (err: any) {
    handleHeaderError('Failed to mark articles as read')
  }
}

const dismissSummary = () => {
  summaryText.value = ''
  summaryArticleIds.value = []
  summaryError.value = ''
}

// Group articles by feed for better organization
const articlesByFeed = computed(() => {
  const grouped = new Map<number, { feed: { id: number; title: string; faviconUrl?: string }; articles: typeof searchedArticles.value }>()

  searchedArticles.value.forEach(article => {
    if (!grouped.has(article.feedId)) {
      grouped.set(article.feedId, {
        feed: {
          id: article.feedId,
          title: article.feedTitle || 'Unknown Feed',
          faviconUrl: article.feedFavicon || undefined
        },
        articles: []
      })
    }
    grouped.get(article.feedId)!.articles.push(article)
  })

  // Convert to array and sort by feed title
  return Array.from(grouped.values()).sort((a, b) =>
    a.feed.title.localeCompare(b.feed.title)
  )
})

const handleRefreshTag = async () => {
  try {
    // Refresh all feeds in this tag
    const feedIds = selectedTagFeedIds.value
    if (feedIds.length === 0) return

    handleHeaderSuccess(`Refreshing ${feedIds.length} feed${feedIds.length > 1 ? 's' : ''}...`)

    await Promise.all(feedIds.map(id => refreshFeed(id)))

    // Refresh the articles list
    await fetchArticles(undefined, selectedTagFeedIds.value)

    handleHeaderSuccess('Tag refreshed successfully!')
  } catch (error) {
    console.error('Failed to refresh tag:', error)
    handleHeaderError('Failed to refresh tag')
  }
}

const handleViewSaved = () => {
  router.push('/saved')
}

// Mark all articles in a specific feed as read
const handleMarkFeedAsRead = async (feedId: number, articles: typeof searchedArticles.value) => {
  try {
    // Get unread article IDs from this feed
    const unreadArticleIds = articles.filter(article => !article.isRead).map(article => article.id)

    if (unreadArticleIds.length === 0) {
      handleHeaderSuccess('All articles in this feed are already read')
      return
    }

    // Mark all unread articles in this feed as read
    await Promise.all(unreadArticleIds.map(id => markAsRead(id, true)))

    handleHeaderSuccess(`Marked ${unreadArticleIds.length} article${unreadArticleIds.length !== 1 ? 's' : ''} as read`)
  } catch (error) {
    console.error('Failed to mark feed articles as read:', error)
    handleHeaderError('Failed to mark articles as read')
  }
}

// Load feeds and articles on mount
onMounted(async () => {
  const init = await initializeArticlePage()

  if (init.success && init.feedsReady) {
    // Wait for feeds to be ready, then fetch articles immediately
    // (don't wait for tags, saved articles, etc.)
    await init.feedsReady

    // Set the selected tag to match the route
    selectedTag.value = tagName.value

    // Fetch articles for this tag (starts while other data still loading)
    await fetchArticles(undefined, selectedTagFeedIds.value)
  }
})

// Watch for tag name changes (but not on initial mount since onMounted handles that)
watch(tagName, async (newTagName) => {
  if (newTagName && newTagName !== selectedTag.value) {
    // IMMEDIATELY clear old articles for instant visual feedback
    clearArticles()
    dismissSummary()

    // Update the selected tag
    selectedTag.value = newTagName

    // Fetch articles for the new tag
    await fetchArticles(undefined, selectedTagFeedIds.value)
  }
})

// Register global keyboard shortcuts
useKeyboardShortcuts({
  helpDialogRef,
  toggleMenu,
  selectedArticleId,
  displayedArticles,
  selectedFeedId: computed(() => null),
  showUnreadOnly: computed(() => false),
  markAsRead,
  refreshFeed: async () => {},
  syncAll,
  toggleSaveArticle,
  handleMarkAsRead,
  handleMarkAllRead: markAllReadHandler,
  selectionMode,
  selectedArticleIds,
  toggleSelection
})
</script>

<style scoped>
.summary-content :deep(a) {
  color: var(--almanac-accent);
  text-decoration: underline;
}
.summary-content :deep(a):hover {
  opacity: 0.8;
}
.summary-content :deep(p) {
  margin-bottom: 0.75em;
}
.summary-content :deep(ul),
.summary-content :deep(ol) {
  margin: 0.5em 0 0.75em 1.25em;
  list-style: disc;
}
</style>
