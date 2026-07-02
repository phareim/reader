import type { Article, ArticlesResponse } from '~/types'
import { cardImageUrl } from '~/utils/cardData'

export const useArticles = () => {
  const articles = useState<Article[]>('articles', () => [])
  // Ids we've already fired a background prefetch for this session — a full-text
  // fetch is one external round-trip + R2 write, so never repeat one.
  const prefetched = useState<Set<number>>('articlesPrefetched', () => new Set())
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

      if (tag) params.tag = tag

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
      if (err?.statusCode === 404 && (tag || feedId !== undefined)) throw err
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

      // Trigger feeds refresh in background (non-blocking)
      const { fetchFeeds } = useFeeds()
      fetchFeeds().catch(err => console.error('Background feed refresh failed:', err))
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

      // Trigger feeds refresh in background (non-blocking)
      const { fetchFeeds } = useFeeds()
      fetchFeeds().catch(err => console.error('Background feed refresh failed:', err))

      return response
    } catch (err: any) {
      error.value = err.message || 'Failed to mark all as read'
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * Warm the card *behind* the top of the deck: run its full-text fetch so the
   * source page's og:image backfills `imageUrl` (an imageless card gains a
   * picture in the peek) and its body lands in R2 (opening it is then instant).
   * Fire-and-forget, deduped, and only for cards that would actually gain from
   * it — a card that already has a usable image, or was already fetched/failed,
   * is left alone so we never spend a round-trip for nothing.
   */
  const prefetchArticle = async (id: number) => {
    if (prefetched.value.has(id)) return
    const article = articles.value.find(a => a.id === id)
    if (!article) return
    const status = article.fullTextStatus
    if (status === 'fetched' || status === 'failed' || status === 'skipped') return
    if (cardImageUrl(article.imageUrl)) return // already shows a picture
    prefetched.value.add(id)

    try {
      const res = await $fetch<{ status: string; imageUrl: string | null }>(
        `/api/articles/${id}/fetch-fulltext`,
        { method: 'POST' }
      )
      // Mutating the object in place is reactive (Vue tracks the array element),
      // and the deck's card snapshot shares these same object references.
      const target = articles.value.find(a => a.id === id)
      if (target) {
        if (res.imageUrl) target.imageUrl = res.imageUrl
        target.fullTextStatus = res.status
      }
    } catch {
      // Best-effort — the reader still fetches on open. Leave it in the deduped
      // set so a flaky page isn't hammered on every deck shuffle.
    }
  }

  // Clear articles immediately (for navigation transitions)
  const clearArticles = () => {
    articles.value = []
    selectedArticleId.value = null
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
    prefetchArticle,
    clearArticles
  }
}
