/**
 * Search functionality for filtering articles in current view
 */
import type { Article } from '~/types'

export const useArticleSearch = () => {
  const searchQuery = useState<string>('articleSearchQuery', () => '')

  const filterArticles = (articles: Article[], query: string): Article[] => {
    if (!query || query.trim() === '') {
      return articles
    }

    const lowerQuery = query.toLowerCase().trim()

    return articles.filter(article => {
      // Search in title
      if (article.title?.toLowerCase().includes(lowerQuery)) {
        return true
      }

      // Search in summary
      if (article.summary?.toLowerCase().includes(lowerQuery)) {
        return true
      }

      // Search in author
      if (article.author?.toLowerCase().includes(lowerQuery)) {
        return true
      }

      // Search in feed title
      if (article.feedTitle?.toLowerCase().includes(lowerQuery)) {
        return true
      }

      return false
    })
  }

  const clearSearch = () => {
    searchQuery.value = ''
  }

  return {
    searchQuery,
    filterArticles,
    clearSearch
  }
}
