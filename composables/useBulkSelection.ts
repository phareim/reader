/**
 * Bulk article selection for multi-select operations
 */
export const useBulkSelection = () => {
  const selectionMode = useState<boolean>('bulkSelectionMode', () => false)
  const selectedArticleIds = useState<Set<number>>('selectedArticleIds', () => new Set())
  const lastSelectedId = useState<number | null>('lastSelectedArticleId', () => null)

  const toggleSelectionMode = () => {
    selectionMode.value = !selectionMode.value
    if (!selectionMode.value) {
      clearSelection()
    }
  }

  const isSelected = (id: number): boolean => {
    return selectedArticleIds.value.has(id)
  }

  const toggleSelection = (id: number, articles?: Array<{ id: number }>, shiftKey = false) => {
    const newSelection = new Set(selectedArticleIds.value)

    if (shiftKey && lastSelectedId.value !== null && articles) {
      // Shift+Click: select range
      const ids = articles.map(a => a.id)
      const startIdx = ids.indexOf(lastSelectedId.value)
      const endIdx = ids.indexOf(id)

      if (startIdx !== -1 && endIdx !== -1) {
        const [start, end] = startIdx < endIdx ? [startIdx, endIdx] : [endIdx, startIdx]
        for (let i = start; i <= end; i++) {
          newSelection.add(ids[i])
        }
      }
    } else {
      // Regular click: toggle individual
      if (newSelection.has(id)) {
        newSelection.delete(id)
      } else {
        newSelection.add(id)
      }
    }

    selectedArticleIds.value = newSelection
    lastSelectedId.value = id
  }

  const selectAll = (articles: Array<{ id: number }>) => {
    selectedArticleIds.value = new Set(articles.map(a => a.id))
  }

  const clearSelection = () => {
    selectedArticleIds.value = new Set()
    lastSelectedId.value = null
  }

  const selectedCount = computed(() => selectedArticleIds.value.size)

  return {
    selectionMode,
    selectedArticleIds,
    selectedCount,
    toggleSelectionMode,
    isSelected,
    toggleSelection,
    selectAll,
    clearSelection
  }
}
