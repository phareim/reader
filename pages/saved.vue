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
        :selected-feed-id="-1"
        :selected-tag="null"
        :is-loading="articlesLoading"
        @toggle-menu="toggleMenu"
        @mark-all-read="() => {}"
        @refresh-feed="() => {}"
        @sync-all="handleSyncAll"
        @view-saved="() => {}"
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

        <div v-if="articlesLoading" class="divide-y divide-rule">
          <ArticleCardSkeleton v-for="i in 6" :key="i" />
        </div>

        <!-- Article Reading Column -->
        <template v-else-if="articles.length > 0">
          <template v-for="(article, index) in articles" :key="article.id">
            <SectionDivider v-if="index > 0" />
            <LazyArticleCard
              :article="article"
              :is-selected="selectedArticleId === article.id"
              :is-saved="true"
              :show-feed-title="true"
              :allow-swipe="false"
              :all-tags-with-counts="allTagsWithCounts"
              @toggle-save="toggleSaveArticle(article.id)"
              @toggle-read="handleToggleRead(article.id)"
              @update-tags="handleUpdateTags"
              @delete-article="handleDeleteArticle(article.id)"
            />
          </template>
        </template>

        <!-- Empty State -->
        <div v-else class="flex flex-col items-center justify-center py-24 text-center">
          <OrbitalGlyph :size="56" class="mb-6" />
          <SerifHeadline level="h2" class="mb-2">Nothing stored yet</SerifHeadline>
          <p class="font-serif text-[14px] text-mute mb-6 max-w-almanac-measure">
            Articles you store will gather here.
          </p>
          <NuxtLink to="/">
            <ActionLabel label="BROWSE" accent />
          </NuxtLink>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useKeyboardShortcuts } from '~/composables/useKeyboardShortcuts'

definePageMeta({
  middleware: 'auth'
})

const router = useRouter()

const {
  feeds,
  fetchFeeds,
  syncAll
} = useFeeds()

const {
  articles,
  selectedArticleId,
  loading: articlesLoading,
  fetchArticles,
  markAsRead
} = useArticles()

const {
  fetchSavedArticleIds
} = useSavedArticles()

const {
  allTagsWithCounts,
  fetchTags
} = useTags()

const {
  fetchSavedArticlesByTag
} = useSavedArticlesByTag()

// Shared article handlers
const {
  toggleSaveArticle: _toggleSaveArticle,
  handleToggleRead,
  handleUpdateTags,
  handleMarkAsRead
} = useArticleViewHandlers()

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

// Override toggleSaveArticle to refresh the saved articles list
const toggleSaveArticle = async (articleId: number) => {
  await _toggleSaveArticle(articleId)
  await fetchArticles(-1) // Refresh saved articles
}

// Delete an article (only for manually added articles)
const handleDeleteArticle = async (articleId: number) => {
  try {
    await $fetch(`/api/articles/${articleId}/delete`, {
      method: 'DELETE'
    })

    // Refresh the articles list
    await fetchArticles(-1)
    await fetchSavedArticlesByTag()
    await fetchFeeds()

    handleHeaderSuccess('Article deleted successfully')
  } catch (error: any) {
    console.error('Failed to delete article:', error)
    handleHeaderError(error.data?.message || error.message || 'Failed to delete article')
  }
}

// Load feeds and saved articles on mount
onMounted(async () => {
  await initializeArticlePage()

  // Fetch saved articles
  await fetchArticles(-1)
})

// Register global keyboard shortcuts
useKeyboardShortcuts({
  helpDialogRef,
  toggleMenu,
  selectedArticleId,
  displayedArticles: computed(() => articles.value),
  selectedFeedId: computed(() => -1),
  showUnreadOnly: computed(() => false),
  markAsRead,
  refreshFeed: async () => {},
  syncAll,
  toggleSaveArticle,
  handleMarkAsRead,
  handleMarkAllRead: async () => {}
})
</script>
