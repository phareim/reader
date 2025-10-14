export const useSavedArticles = () => {
  const savedArticleIds = useState<Set<number>>('savedArticleIds', () => new Set())
  const loading = useState<boolean>('savedArticlesLoading', () => false)
  const error = useState<string | null>('savedArticlesError', () => null)

  const isSaved = (articleId: number) => {
    return savedArticleIds.value.has(articleId)
  }

  const fetchSavedArticleIds = async () => {
    loading.value = true
    error.value = null

    try {
      const response = await $fetch<{ articles: Array<{ id: number }> }>('/api/saved-articles')
      savedArticleIds.value = new Set(response.articles.map(a => a.id))
    } catch (err: any) {
      error.value = err.message || 'Failed to fetch saved articles'
      console.error('Error fetching saved articles:', err)
    } finally {
      loading.value = false
    }
  }

  const saveArticle = async (articleId: number) => {
    // Optimistic update
    savedArticleIds.value.add(articleId)

    try {
      await $fetch(`/api/articles/${articleId}/save`, {
        method: 'POST'
      })
    } catch (err: any) {
      // Revert on error
      savedArticleIds.value.delete(articleId)
      error.value = err.message || 'Failed to save article'
      throw err
    }
  }

  const unsaveArticle = async (articleId: number) => {
    // Optimistic update
    savedArticleIds.value.delete(articleId)

    try {
      await $fetch(`/api/articles/${articleId}/save`, {
        method: 'DELETE'
      })
    } catch (err: any) {
      // Revert on error
      savedArticleIds.value.add(articleId)
      error.value = err.message || 'Failed to unsave article'
      throw err
    }
  }

  const toggleSave = async (articleId: number) => {
    if (isSaved(articleId)) {
      await unsaveArticle(articleId)
    } else {
      await saveArticle(articleId)
    }
  }

  return {
    savedArticleIds: readonly(savedArticleIds),
    loading: readonly(loading),
    error: readonly(error),
    isSaved,
    fetchSavedArticleIds,
    saveArticle,
    unsaveArticle,
    toggleSave
  }
}
