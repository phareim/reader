/**
 * Common functionality shared across all article view pages
 * Handles menu, auth, and common page setup
 */
export const useArticlePageCommon = () => {
  const { syncAll } = useFeeds()
  const { signOut } = useAuth()

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
    await signOut({ callbackUrl: '/login' })
  }

  // Common initialization for all article pages
  const initializeArticlePage = async () => {
    const { data: session } = useAuth()

    if (!session.value?.user) {
      return false
    }

    const { fetchFeeds } = useFeeds()
    const { fetchSavedArticleIds } = useSavedArticles()
    const { fetchTags } = useTags()
    const { fetchSavedArticlesByTag } = useSavedArticlesByTag()

    await Promise.all([
      fetchFeeds(),
      fetchSavedArticleIds(),
      fetchTags(),
      fetchSavedArticlesByTag()
    ])

    return true
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
