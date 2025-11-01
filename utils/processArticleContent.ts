/**
 * Utility for processing article HTML content
 * Extracted from pages/article/[id].vue for reusability and testability
 */

/**
 * Process article HTML content to make all links open in new tabs
 * This ensures external links don't navigate away from the reader
 *
 * @param content - Raw HTML content from the article
 * @returns Processed HTML with target="_blank" and rel="noopener noreferrer" on all links
 */
export function processArticleContent(content: string | null | undefined): string | null {
  if (!content) return null

  // Create a temporary div to parse the HTML
  const div = document.createElement('div')
  div.innerHTML = content

  // Find all links and add target="_blank" and rel attributes
  const links = div.querySelectorAll('a')
  links.forEach(link => {
    link.setAttribute('target', '_blank')
    link.setAttribute('rel', 'noopener noreferrer')
  })

  return div.innerHTML
}

/**
 * Check if article content is available
 */
export function hasArticleContent(content: string | null | undefined): boolean {
  return !!(content && content.trim().length > 0)
}

/**
 * Get a plain text excerpt from HTML content
 * Useful for previews or search indexing
 *
 * @param content - HTML content
 * @param maxLength - Maximum length of excerpt
 * @returns Plain text excerpt
 */
export function getArticleExcerpt(content: string | null | undefined, maxLength = 200): string {
  if (!content) return ''

  const div = document.createElement('div')
  div.innerHTML = content
  const text = div.textContent || div.innerText || ''

  if (text.length <= maxLength) {
    return text
  }

  return text.substring(0, maxLength).trim() + '...'
}
