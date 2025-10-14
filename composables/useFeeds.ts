import type { Feed } from '~/types'

export const useFeeds = () => {
  const feeds = useState<Feed[]>('feeds', () => [])
  const selectedFeedId = useState<number | null>('selectedFeedId', () => null)
  const loading = useState<boolean>('feedsLoading', () => false)
  const error = useState<string | null>('feedsError', () => null)

  const selectedFeed = computed(() =>
    feeds.value.find(f => f.id === selectedFeedId.value)
  )

  const totalUnreadCount = computed(() =>
    feeds.value.reduce((sum, feed) => sum + feed.unreadCount, 0)
  )

  const fetchFeeds = async () => {
    loading.value = true
    error.value = null

    try {
      const response = await $fetch<{ feeds: Feed[] }>('/api/feeds')
      feeds.value = response.feeds
    } catch (err: any) {
      error.value = err.message || 'Failed to fetch feeds'
      console.error('Error fetching feeds:', err)
    } finally {
      loading.value = false
    }
  }

  const addFeed = async (url: string) => {
    loading.value = true
    error.value = null

    try {
      const response = await $fetch<{ feed: any; articlesAdded: number }>('/api/feeds', {
        method: 'POST',
        body: { url }
      })

      // Refresh feeds to get updated unread counts
      await fetchFeeds()

      return response
    } catch (err: any) {
      error.value = err.data?.message || err.message || 'Failed to add feed'
      throw err
    } finally {
      loading.value = false
    }
  }

  const deleteFeed = async (id: number) => {
    loading.value = true
    error.value = null

    try {
      await $fetch(`/api/feeds/${id}`, { method: 'DELETE' })

      // Remove from local state
      feeds.value = feeds.value.filter(f => f.id !== id)

      // Clear selection if deleted feed was selected
      if (selectedFeedId.value === id) {
        selectedFeedId.value = null
      }
    } catch (err: any) {
      error.value = err.message || 'Failed to delete feed'
      throw err
    } finally {
      loading.value = false
    }
  }

  const refreshFeed = async (id: number) => {
    try {
      const response = await $fetch<{ success: boolean; newArticles: number }>(
        `/api/feeds/${id}/refresh`,
        { method: 'POST' }
      )

      // Refresh feeds to get updated unread counts
      await fetchFeeds()

      return response
    } catch (err: any) {
      error.value = err.data?.message || err.message || 'Failed to refresh feed'
      throw err
    }
  }

  const syncAll = async () => {
    loading.value = true
    error.value = null

    try {
      const response = await $fetch<any>('/api/sync', { method: 'POST' })

      // Refresh feeds to get updated unread counts
      await fetchFeeds()

      return response
    } catch (err: any) {
      error.value = err.message || 'Failed to sync feeds'
      throw err
    } finally {
      loading.value = false
    }
  }

  const updateFeedTags = async (id: number, tags: string[]) => {
    try {
      const response = await $fetch<{ success: boolean; tags: string[] }>(
        `/api/feeds/${id}/tags`,
        {
          method: 'PATCH',
          body: { tags }
        }
      )

      // Update local state
      const feedIndex = feeds.value.findIndex(f => f.id === id)
      if (feedIndex !== -1) {
        feeds.value[feedIndex].tags = response.tags
      }

      return response
    } catch (err: any) {
      error.value = err.data?.message || err.message || 'Failed to update feed tags'
      throw err
    }
  }

  return {
    feeds: readonly(feeds),
    selectedFeedId,
    selectedFeed,
    totalUnreadCount,
    loading: readonly(loading),
    error: readonly(error),
    fetchFeeds,
    addFeed,
    deleteFeed,
    refreshFeed,
    syncAll,
    updateFeedTags
  }
}
