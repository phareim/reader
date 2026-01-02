import { Article } from './index'

export interface SummarizeRequest {
  // Source selection (exactly one required)
  feedId?: number
  feedIds?: number[]
  tag?: string
  savedTag?: string

  // Filters
  isRead?: boolean
  limit?: number
  sinceDate?: string
}

export interface SummarizeMetadata {
  articlesAnalyzed: number
  articlesIncluded: number
  generatedAt: string
  model: string
  feedTitles: string[]
  tokenUsage: {
    input: number
    output: number
  }
}

export interface SummarizeResponse {
  success: boolean
  summary: string
  metadata: SummarizeMetadata
  error?: string
}

export interface ArticleForSummary extends Article {
  // Ensure we have the fields needed for summarization
  content?: string | null
  summary?: string | null
  imageUrl?: string | null
}
