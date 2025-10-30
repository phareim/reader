import type { Article, ArticlesResponse } from '~/types'

export const useArticles = () => {
  const articles = useState<Article[]>('articles', () => [])
  const selectedArticleId = useState<number | null>('selectedArticleId', () => null)
  const showUnreadOnly = useState<boolean>('showUnreadOnly', () => true)
  const loading = useState<boolean>('articlesLoading', () => false)
  const error = useState<string | null>('articlesError', () => null)

  const selectedArticle = computed(() =>
    articles.value.find(a => a.id === selectedArticleId.value)
  )

  const displayedArticles = computed(() => {
    if (showUnreadOnly.value) {
      // Show unread articles + currently selected article (even if read)
      return articles.value.filter(a => !a.isRead || a.id === selectedArticleId.value)
    }
    return articles.value
  })

  const unreadArticles = computed(() =>
    articles.value.filter(a => !a.isRead)
  )

  const fetchArticles = async (feedId?: number, feedIds?: number[], tag?: string) => {
    // Special case: feedId = -1 means fetch saved articles
    if (feedId === -1) {
      return fetchSavedArticles(tag)
    }

    loading.value = true
    error.value = null

    try {
      const params: any = { limit: 100 }

      // If feedIds array is provided (for tag-based fetching), use it
      if (feedIds && feedIds.length > 0) {
        params.feedIds = feedIds.join(',')
      } else if (feedId !== undefined) {
        params.feedId = feedId
      }

      if (showUnreadOnly.value) {
        params.isRead = 'false'
      }

      // Exclude saved articles from feed views
      params.excludeSaved = 'true'

      const response = await $fetch<ArticlesResponse>('/api/articles', {
        params
      })

      articles.value = response.articles
    } catch (err: any) {
      error.value = err.message || 'Failed to fetch articles'
      console.error('Error fetching articles:', err)
    } finally {
      loading.value = false
    }
  }

  const fetchSavedArticles = async (tag?: string) => {
    loading.value = true
    error.value = null

    try {
      const params: any = {}
      if (tag) {
        params.tag = tag
      }

      const response = await $fetch<{ articles: Article[] }>('/api/saved-articles', {
        params
      })
      articles.value = response.articles
    } catch (err: any) {
      error.value = err.message || 'Failed to fetch saved articles'
      console.error('Error fetching saved articles:', err)
    } finally {
      loading.value = false
    }
  }

  const markAsRead = async (id: number, isRead: boolean) => {
    // Optimistic update
    const article = articles.value.find(a => a.id === id)
    if (article) {
      article.isRead = isRead
      article.readAt = isRead ? new Date().toISOString() : null
    }

    try {
      await $fetch(`/api/articles/${id}/read`, {
        method: 'PATCH',
        body: { isRead }
      })

      // Trigger feeds refresh to update unread counts
      const { fetchFeeds } = useFeeds()
      await fetchFeeds()
    } catch (err: any) {
      // Revert optimistic update on error
      if (article) {
        article.isRead = !isRead
        article.readAt = null
      }
      error.value = err.message || 'Failed to update article'
      throw err
    }
  }

  const markAllAsRead = async (feedId?: number) => {
    loading.value = true
    error.value = null

    try {
      const body: any = {}
      if (feedId !== undefined) {
        body.feedId = feedId
      }

      const response = await $fetch<{ markedCount: number }>('/api/articles/mark-all-read', {
        method: 'POST',
        body
      })

      // Update local state
      articles.value.forEach(article => {
        if (feedId === undefined || article.feedId === feedId) {
          article.isRead = true
          article.readAt = new Date().toISOString()
        }
      })

      // Trigger feeds refresh to update unread counts
      const { fetchFeeds } = useFeeds()
      await fetchFeeds()

      return response
    } catch (err: any) {
      error.value = err.message || 'Failed to mark all as read'
      throw err
    } finally {
      loading.value = false
    }
  }

  const selectNextArticle = () => {
    const currentIndex = displayedArticles.value.findIndex(
      a => a.id === selectedArticleId.value
    )
    if (currentIndex < displayedArticles.value.length - 1) {
      selectedArticleId.value = displayedArticles.value[currentIndex + 1].id
      // Auto-mark as read
      markAsRead(selectedArticleId.value, true)
    }
  }

  const selectPreviousArticle = () => {
    const currentIndex = displayedArticles.value.findIndex(
      a => a.id === selectedArticleId.value
    )
    if (currentIndex > 0) {
      selectedArticleId.value = displayedArticles.value[currentIndex - 1].id
      // Auto-mark as read
      markAsRead(selectedArticleId.value, true)
    }
  }

  return {
    articles: readonly(articles),
    selectedArticleId,
    selectedArticle,
    showUnreadOnly,
    displayedArticles,
    unreadArticles,
    loading: readonly(loading),
    error: readonly(error),
    fetchArticles,
    markAsRead,
    markAllAsRead,
    selectNextArticle,
    selectPreviousArticle
  }
}
