/**
 * Composable for organizing saved articles by tags
 * Uses efficient server-side aggregation instead of fetching all articles
 */
export const useSavedArticlesByTag = () => {
  const savedArticlesByTag = useState<Record<string, { tag: string; count: number }>>('savedArticlesByTag', () => ({}))
  const savedArticleTags = useState<string[]>('savedArticleTags', () => [])
  const totalSavedCount = useState<number>('totalSavedCount', () => 0)

  // Fetch saved article counts by tag (uses efficient server-side aggregation)
  const fetchSavedArticlesByTag = async () => {
    try {
      const response = await $fetch<{
        total: number
        byTag: Record<string, { tag: string; count: number }>
        tags: string[]
      }>('/api/saved-articles/counts')

      savedArticlesByTag.value = response.byTag
      savedArticleTags.value = response.tags
      totalSavedCount.value = response.total
    } catch (error) {
      console.error('Error fetching saved articles by tag:', error)
    }
  }

  const getSavedTagCount = (tag: string) => {
    return savedArticlesByTag.value[tag]?.count || 0
  }

  return {
    savedArticlesByTag: readonly(savedArticlesByTag),
    savedArticleTags: readonly(savedArticleTags),
    totalSavedCount: readonly(totalSavedCount),
    fetchSavedArticlesByTag,
    getSavedTagCount
  }
}
