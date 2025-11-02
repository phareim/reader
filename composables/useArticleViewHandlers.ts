/**
 * Shared handlers for article view pages
 * Reduces code duplication across index.vue, feed/[id].vue, and tag/[name].vue
 */
export const useArticleViewHandlers = () => {
  const {
    articles,
    selectedArticleId,
    displayedArticles,
    markAsRead,
    markAllAsRead
  } = useArticles()

  const { toggleSave } = useSavedArticles()
  const { updateSavedArticleTags, fetchTags } = useTags()
  const { fetchSavedArticlesByTag } = useSavedArticlesByTag()

  // Toggle save/unsave article
  const toggleSaveArticle = async (articleId: number) => {
    try {
      await toggleSave(articleId)
      await fetchSavedArticlesByTag()
    } catch (error) {
      console.error('Failed to toggle save:', error)
      throw error
    }
  }

  // Toggle read/unread status
  const handleToggleRead = async (articleId: number) => {
    try {
      const article = displayedArticles.value.find(a => a.id === articleId)
      if (article) {
        await markAsRead(articleId, !article.isRead)
      }
    } catch (error) {
      console.error('Failed to toggle read status:', error)
      throw error
    }
  }

  // Update tags for a saved article with optimistic updates
  const handleUpdateTags = async (savedArticleId: number, tags: string[]) => {
    const article = articles.value.find(a => a.savedId === savedArticleId)
    const previousTags = article?.tags || []

    // Optimistic update
    if (article) {
      article.tags = tags
    }

    try {
      await updateSavedArticleTags(savedArticleId, tags)
      await Promise.all([
        fetchTags(),
        fetchSavedArticlesByTag()
      ])
    } catch (error) {
      console.error('Failed to update tags:', error)
      // Revert optimistic update on error
      if (article) {
        article.tags = previousTags
      }
      throw error
    }
  }

  // Mark selected article as read without opening
  const handleMarkAsRead = async () => {
    if (selectedArticleId.value !== null) {
      const article = displayedArticles.value.find(a => a.id === selectedArticleId.value)
      if (article && !article.isRead) {
        await markAsRead(selectedArticleId.value, true)
      }
    }
  }

  // Mark all articles in current view as read
  const handleMarkAllRead = async (feedId?: number) => {
    try {
      if (feedId !== undefined) {
        // Mark all in specific feed
        await markAllAsRead(feedId)
      } else {
        // Mark all in current view (tag or all)
        const articlesToMark = displayedArticles.value.filter(a => !a.isRead)

        // Optimistically update all articles at once
        articlesToMark.forEach(article => {
          article.isRead = true
          article.readAt = new Date().toISOString()
        })

        // Then make API calls in background
        Promise.all(articlesToMark.map(article =>
          markAsRead(article.id, true).catch(err => {
            // Revert on error
            article.isRead = false
            article.readAt = null
            console.error('Failed to mark article as read:', err)
          })
        ))
      }
    } catch (error) {
      console.error('Failed to mark all as read:', error)
      throw error
    }
  }

  return {
    toggleSaveArticle,
    handleToggleRead,
    handleUpdateTags,
    handleMarkAsRead,
    handleMarkAllRead
  }
}
