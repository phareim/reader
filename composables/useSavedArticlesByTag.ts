import type { Tag } from './useTags'

/**
 * Composable for organizing saved articles by tags
 */
export const useSavedArticlesByTag = () => {
  const savedArticlesByTag = useState<Record<string, { tag: string; count: number }>>('savedArticlesByTag', () => ({}))
  const savedArticleTags = useState<string[]>('savedArticleTags', () => [])
  const totalSavedCount = useState<number>('totalSavedCount', () => 0)

  // Fetch saved article counts by tag
  const fetchSavedArticlesByTag = async () => {
    try {
      const response = await $fetch<{ articles: Array<{ tags: string[] }> }>('/api/saved-articles')

      // Count articles by tag
      const tagCounts: Record<string, number> = {}
      let untaggedCount = 0

      response.articles.forEach(article => {
        if (article.tags && article.tags.length > 0) {
          article.tags.forEach(tag => {
            tagCounts[tag] = (tagCounts[tag] || 0) + 1
          })
        } else {
          untaggedCount++
        }
      })

      // Build savedArticlesByTag structure
      const byTag: Record<string, { tag: string; count: number }> = {}
      Object.keys(tagCounts).forEach(tag => {
        byTag[tag] = { tag, count: tagCounts[tag] }
      })

      // Add inbox for untagged
      if (untaggedCount > 0) {
        byTag['__inbox__'] = { tag: '__inbox__', count: untaggedCount }
      }

      savedArticlesByTag.value = byTag
      savedArticleTags.value = Object.keys(tagCounts).sort()
      totalSavedCount.value = response.articles.length
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
