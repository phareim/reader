import { Article } from '~/types'
import { SummarizeMetadata } from '~/types/summarization'
import { stripHtmlTags, extractTextContent } from './htmlStripper'

/**
 * Build system prompt for Claude
 */
export function buildSystemPrompt(): string {
  return `You are a professional newsletter editor tasked with creating engaging, informative summaries of RSS articles.

Your output should:
1. Group related articles by theme or topic
2. Provide concise, engaging summaries that capture key insights
3. ALWAYS cite sources with [Article Title](URL) markdown links
4. Use a newsletter-friendly tone: informative but approachable
5. Highlight the most interesting or important points
6. Create clear section headings for each topic group

Format your response in Markdown with:
- ## Topic/Section headings
- Bullet points or short paragraphs for each article
- Inline citations using [title](url) format
- A brief introduction (2-3 sentences) at the top

Avoid:
- Generic phrases like "this article discusses"
- Redundant information across summaries
- Citations without context (always explain WHY an article matters)`
}

/**
 * Build user prompt with article data
 */
export function buildUserPrompt(articles: Article[], sourceName?: string): string {
  const sourceDescription = sourceName || 'your feeds'

  const articlesSection = articles.map((article, i) => {
    const content = extractArticleContent(article)
    const publishedDate = article.publishedAt
      ? new Date(article.publishedAt).toLocaleDateString()
      : 'Unknown date'

    return `### Article ${i + 1}
**Title**: ${article.title}
**Source**: ${article.feedTitle}
**URL**: ${article.url}
**Published**: ${publishedDate}
${article.author ? `**Author**: ${article.author}\n` : ''}
**Content**:
${content}

---`
  }).join('\n\n')

  return `Generate a newsletter-style summary of the following ${articles.length} articles from ${sourceDescription}.

${articlesSection}

Please organize these articles into thematic sections with engaging summaries. Focus on key insights and actionable information. Every piece of information must cite its source article using markdown links in the format [Article Title](URL).`
}

/**
 * Extract content from article for prompt
 */
export function extractArticleContent(article: Article): string {
  const rawContent = article.content || article.summary || ''

  if (!rawContent) {
    return '[No content preview available - title only]'
  }

  // Extract up to 800 characters of clean text
  // This balances context with token budget (50 articles × 800 chars ≈ 10K tokens)
  return extractTextContent(rawContent, 800)
}

/**
 * Estimate token count for articles
 * Simple heuristic: characters × 0.25 ≈ tokens
 */
export function estimateTokenCount(articles: Article[]): number {
  let totalChars = 0

  // System prompt
  totalChars += buildSystemPrompt().length

  // User prompt overhead
  totalChars += 200 // Template text

  // Per article
  articles.forEach(article => {
    // Metadata (title, url, etc.)
    totalChars += 200

    // Content
    const content = extractArticleContent(article)
    totalChars += content.length
  })

  return Math.ceil(totalChars * 0.25)
}

/**
 * Calculate max tokens for response based on article count
 */
export function calculateMaxTokens(articleCount: number): number {
  if (articleCount <= 10) return 4096
  if (articleCount <= 30) return 8192
  return 12000
}

/**
 * Format the final newsletter response with metadata footer
 */
export function formatNewsletterResponse(
  claudeText: string,
  metadata: SummarizeMetadata
): string {
  const feedList = metadata.feedTitles.length <= 3
    ? metadata.feedTitles.join(', ')
    : `${metadata.feedTitles.length} feeds`

  const generatedDate = new Date(metadata.generatedAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })

  const footer = `\n\n---\n\n*This summary analyzed ${metadata.articlesAnalyzed} articles from ${feedList}. Generated on ${generatedDate} using ${metadata.model}.*`

  return claudeText + footer
}
