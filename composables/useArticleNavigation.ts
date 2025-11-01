/**
 * Composable for managing article navigation (prev/next)
 * Fetches adjacent articles from the same feed
 */

import { ref, type Ref } from 'vue'

export interface UseArticleNavigationOptions {
  currentArticleId: Ref<number>
  feedId: Ref<number | null | undefined>
}

/**
 * Composable for finding previous/next articles in a feed
 */
export function useArticleNavigation(options: UseArticleNavigationOptions) {
  const { currentArticleId, feedId } = options

  const prevArticleId = ref<number | null>(null)
  const nextArticleId = ref<number | null>(null)
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  /**
   * Fetch adjacent articles from the same feed
   */
  async function fetchAdjacentArticles() {
    if (!feedId.value) {
      prevArticleId.value = null
      nextArticleId.value = null
      return
    }

    isLoading.value = true
    error.value = null

    try {
      // Fetch all articles from the same feed
      const response = await $fetch('/api/articles', {
        params: {
          feedId: feedId.value,
          limit: 200  // Get more articles to ensure we have context
        }
      })

      const feedArticles = response.articles || []

      // Find current article index
      const currentIndex = feedArticles.findIndex((a: any) => a.id === currentArticleId.value)

      if (currentIndex === -1) {
        prevArticleId.value = null
        nextArticleId.value = null
        return
      }

      // Set previous and next article IDs
      prevArticleId.value = currentIndex > 0 ? feedArticles[currentIndex - 1].id : null
      nextArticleId.value = currentIndex < feedArticles.length - 1 ? feedArticles[currentIndex + 1].id : null
    } catch (e) {
      console.error('Failed to fetch adjacent articles:', e)
      error.value = 'Failed to load navigation'
      prevArticleId.value = null
      nextArticleId.value = null
    } finally {
      isLoading.value = false
    }
  }

  return {
    prevArticleId,
    nextArticleId,
    isLoading,
    error,
    fetchAdjacentArticles
  }
}
