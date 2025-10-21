/**
 * Shared TypeScript types for Reader API responses
 * Used by both the Nuxt server and MCP server
 */

export interface Feed {
  id: number
  title: string
  url: string
  siteUrl: string | null
  faviconUrl: string | null
  tags: string[]
  unreadCount: number
  lastFetchedAt: string | null
  lastError: string | null
  errorCount: number
  isActive: boolean
}

export interface FeedsResponse {
  feeds: Feed[]
}

export interface Article {
  id: number
  feedId: number
  feedTitle: string
  feedFavicon: string | null
  guid: string
  title: string
  url: string
  author: string | null
  content: string | null
  summary: string | null
  publishedAt: string | null
  isRead: boolean
  isStarred: boolean
  readAt: string | null
}

export interface ArticlesResponse {
  articles: Article[]
  total: number
  hasMore: boolean
}

export interface SavedArticle {
  id: number
  feedId: number
  feedTitle: string
  title: string
  url: string
  author: string | null
  content: string | null
  summary: string | null
  publishedAt: string | null
  isRead: boolean
  savedAt: string
  savedId: number
  tags: string[]
}

export interface SavedArticlesResponse {
  articles: SavedArticle[]
}

export interface SaveArticleResponse {
  success: boolean
  savedArticle: {
    id: number
    articleId: number
    savedAt: string
  }
}

export interface UnsaveArticleResponse {
  success: boolean
}

export interface TagArticleResponse {
  success: boolean
  tags: string[]
}

export interface Tag {
  id: number
  name: string
  color: string | null
  createdAt: string
  feedCount: number
  savedArticleCount: number
}

export interface TagsResponse {
  tags: Tag[]
}

export interface AddManualArticleResponse {
  success: boolean
  article: {
    id: number
    title: string
    url: string
    savedAt: string
  }
  tags: string[]
}
