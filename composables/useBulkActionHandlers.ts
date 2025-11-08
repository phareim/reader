/**
 * Shared bulk action handlers for article view pages
 * Handles bulk operations on selected articles
 */
export const useBulkActionHandlers = (options: {
  searchedArticles: ComputedRef<any[]>
  showSuccess: (message: string) => void
  showError: (message: string) => void
}) => {
  const { searchedArticles, showSuccess, showError } = options

  const { markAsRead } = useArticles()
  const { toggleSave } = useSavedArticles()
  const { fetchSavedArticlesByTag } = useSavedArticlesByTag()
  const {
    selectionMode,
    selectedArticleIds,
    toggleSelectionMode,
    toggleSelection,
    clearSelection
  } = useBulkSelection()

  // Handle toggling selection with shift-click support
  const handleToggleSelection = (articleId: number, shiftKey: boolean) => {
    toggleSelection(articleId, searchedArticles.value, shiftKey)
  }

  // Mark all selected articles as read
  const handleBulkMarkRead = async () => {
    try {
      const selectedIds = Array.from(selectedArticleIds.value)
      await Promise.all(selectedIds.map(id => markAsRead(id, true)))
      clearSelection()
      showSuccess(`Marked ${selectedIds.length} article${selectedIds.length !== 1 ? 's' : ''} as read`)
    } catch (error) {
      console.error('Failed to mark articles as read:', error)
      showError('Failed to mark articles as read')
    }
  }

  // Save all selected articles
  const handleBulkSave = async () => {
    try {
      const selectedIds = Array.from(selectedArticleIds.value)
      await Promise.all(selectedIds.map(id => toggleSave(id)))
      clearSelection()
      await fetchSavedArticlesByTag()
      showSuccess(`Saved ${selectedIds.length} article${selectedIds.length !== 1 ? 's' : ''}`)
    } catch (error) {
      console.error('Failed to save articles:', error)
      showError('Failed to save articles')
    }
  }

  // Clear selection without exiting selection mode
  const handleBulkClear = () => {
    clearSelection()
  }

  // Exit selection mode
  const handleBulkExit = () => {
    toggleSelectionMode()
  }

  return {
    selectionMode,
    selectedArticleIds,
    selectedCount: computed(() => selectedArticleIds.value.size),
    toggleSelectionMode,
    handleToggleSelection,
    handleBulkMarkRead,
    handleBulkSave,
    handleBulkClear,
    handleBulkExit
  }
}
