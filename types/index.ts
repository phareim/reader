export interface Feed {
  id: number
  title: string
  url: string
  description?: string | null
  siteUrl?: string | null
  faviconUrl?: string | null
  tags: string[]
  unreadCount: number
  lastFetchedAt?: string | null
  lastError?: string | null
  errorCount: number
  isActive: boolean
}

export interface Article {
  id: number
  feedId: number
  feedTitle: string
  feedFavicon?: string | null
  guid: string
  title: string
  url: string
  author?: string | null
  content?: string | null
  summary?: string | null
  publishedAt?: string | null
  isRead: boolean
  isStarred: boolean
  readAt?: string | null
  savedId?: number  // Present when article is saved (for tag management)
  tags?: string[]   // Tags for saved articles
}

export interface ArticlesResponse {
  articles: Article[]
  total: number
  hasMore: boolean
}

export interface SyncResult {
  feedId: number
  feedTitle: string
  success: boolean
  newArticles?: number
  error?: string
}

export interface SyncResponse {
  results: SyncResult[]
  summary: {
    total: number
    succeeded: number
    failed: number
    newArticles: number
  }
}
