/**
 * Extract article metadata from HTML
 * Detects if a page is an article and extracts relevant metadata
 */

export interface ArticleMetadata {
  isArticle: boolean
  title?: string
  description?: string
  author?: string
  publishedAt?: string
  content?: string
  url: string
  imageUrl?: string
}

/**
 * Extract metadata from meta tags
 */
function extractMetaTag(html: string, property: string): string | undefined {
  // Try property attribute (Open Graph)
  const propertyRegex = new RegExp(
    `<meta\\s+property=["']${property}["']\\s+content=["']([^"']+)["']`,
    'i'
  )
  const propertyMatch = html.match(propertyRegex)
  if (propertyMatch) return propertyMatch[1]

  // Try name attribute (standard meta tags)
  const nameRegex = new RegExp(
    `<meta\\s+name=["']${property}["']\\s+content=["']([^"']+)["']`,
    'i'
  )
  const nameMatch = html.match(nameRegex)
  if (nameMatch) return nameMatch[1]

  // Try reverse order (content before property/name)
  const reversePropertyRegex = new RegExp(
    `<meta\\s+content=["']([^"']+)["']\\s+property=["']${property}["']`,
    'i'
  )
  const reversePropertyMatch = html.match(reversePropertyRegex)
  if (reversePropertyMatch) return reversePropertyMatch[1]

  const reverseNameRegex = new RegExp(
    `<meta\\s+content=["']([^"']+)["']\\s+name=["']${property}["']`,
    'i'
  )
  const reverseNameMatch = html.match(reverseNameRegex)
  if (reverseNameMatch) return reverseNameMatch[1]

  return undefined
}

/**
 * Extract title from HTML
 */
function extractTitle(html: string): string | undefined {
  // Try Open Graph title
  const ogTitle = extractMetaTag(html, 'og:title')
  if (ogTitle) return ogTitle

  // Try Twitter title
  const twitterTitle = extractMetaTag(html, 'twitter:title')
  if (twitterTitle) return twitterTitle

  // Try standard title tag
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
  if (titleMatch) return titleMatch[1].trim()

  // Try h1 tag
  const h1Match = html.match(/<h1[^>]*>([^<]+)<\/h1>/i)
  if (h1Match) return h1Match[1].trim()

  return undefined
}

/**
 * Check if HTML represents an article page
 */
function isArticlePage(html: string): boolean {
  // Check Open Graph type
  const ogType = extractMetaTag(html, 'og:type')
  if (ogType === 'article') return true

  // Check for article-specific meta tags
  if (
    html.includes('article:published_time') ||
    html.includes('article:author') ||
    html.includes('article:section')
  ) {
    return true
  }

  // Check for JSON-LD article schema
  if (html.includes('"@type":"Article"') || html.includes('"@type": "Article"')) {
    return true
  }

  // Check for article tag
  if (html.includes('<article')) {
    return true
  }

  // Check for common article class names
  const articleClassPatterns = [
    'class="article',
    'class="post',
    'class="entry',
    'id="article',
    'id="post',
    'id="content'
  ]

  return articleClassPatterns.some(pattern => html.includes(pattern))
}

/**
 * Extract main content from article HTML
 * Simple extraction - could be enhanced with a library like mozilla/readability
 */
function extractContent(html: string): string | undefined {
  // Try to find article tag
  const articleMatch = html.match(/<article[^>]*>([\s\S]*?)<\/article>/i)
  if (articleMatch) {
    // Strip HTML tags for a simple text version
    const content = articleMatch[1]
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()

    return content.substring(0, 1000) // Limit to 1000 chars for summary
  }

  return undefined
}

/**
 * Extract article metadata from HTML page
 */
export function extractArticleMetadata(html: string, url: string): ArticleMetadata {
  const isArticle = isArticlePage(html)

  if (!isArticle) {
    return {
      isArticle: false,
      url,
      title: extractTitle(html)
    }
  }

  // Extract Open Graph and Twitter metadata
  const title = extractMetaTag(html, 'og:title') ||
                extractMetaTag(html, 'twitter:title') ||
                extractTitle(html)

  const description = extractMetaTag(html, 'og:description') ||
                      extractMetaTag(html, 'twitter:description') ||
                      extractMetaTag(html, 'description')

  const author = extractMetaTag(html, 'article:author') ||
                 extractMetaTag(html, 'author')

  const publishedAt = extractMetaTag(html, 'article:published_time') ||
                      extractMetaTag(html, 'datePublished')

  const imageUrl = extractMetaTag(html, 'og:image') ||
                   extractMetaTag(html, 'twitter:image')

  const content = extractContent(html)

  return {
    isArticle: true,
    title,
    description,
    author,
    publishedAt,
    content,
    url,
    imageUrl
  }
}
