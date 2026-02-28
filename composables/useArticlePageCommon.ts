/**
 * Common functionality shared across all article view pages
 * Handles menu, auth, and common page setup
 */
export const useArticlePageCommon = () => {
  const { syncAll } = useFeeds()
  const { clear } = useUserSession()

  // Menu management
  const hamburgerMenuRef = ref<any>(null)
  const menuIsOpen = computed(() => hamburgerMenuRef.value?.isOpen ?? false)

  const toggleMenu = () => {
    if (hamburgerMenuRef.value) {
      hamburgerMenuRef.value.isOpen = !hamburgerMenuRef.value.isOpen
    }
  }

  // Help dialog
  const helpDialogRef = ref<any>(null)

  // Sync all feeds
  const handleSyncAll = async () => {
    try {
      await syncAll()
    } catch (error) {
      console.error('Failed to sync all feeds:', error)
    }
  }

  // Sign out
  const handleSignOut = async () => {
    await clear()
    navigateTo('/login')
  }

  // Common initialization for all article pages
  // Returns { feedsReady: Promise } so callers can start fetching articles early
  const initializeArticlePage = async () => {
    const { loggedIn } = useUserSession()

    if (!loggedIn.value) {
      return { success: false, feedsReady: Promise.resolve() }
    }

    const { fetchFeeds } = useFeeds()
    const { fetchSavedArticleIds } = useSavedArticles()
    const { fetchTags } = useTags()
    const { fetchSavedArticlesByTag } = useSavedArticlesByTag()

    // Start all fetches in parallel
    const feedsPromise = fetchFeeds()
    const otherPromises = Promise.all([
      fetchSavedArticleIds(),
      fetchTags(),
      fetchSavedArticlesByTag()
    ])

    // Return feedsReady promise so callers can start article fetching early
    return {
      success: true,
      feedsReady: feedsPromise,
      allReady: Promise.all([feedsPromise, otherPromises])
    }
  }

  return {
    // Refs for template
    hamburgerMenuRef,
    helpDialogRef,

    // Computed
    menuIsOpen,

    // Methods
    toggleMenu,
    handleSyncAll,
    handleSignOut,
    initializeArticlePage
  }
}
