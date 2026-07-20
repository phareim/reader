import DOMPurify from 'isomorphic-dompurify'
import { looksLikePlainText, paragraphize } from '~/utils/paragraphize'
import { cleanArticleDom } from '~/utils/cleanArticleContent'

/**
 * Utility for processing article HTML content
 * Extracted from pages/article/[id].vue for reusability and testability
 */

/**
 * Process article HTML content: sanitize and make all links open in new tabs
 * This ensures external links don't navigate away from the reader and prevents XSS
 *
 * @param content - Raw HTML content from the article
 * @param opts.title - Article title, used to drop a duplicated title block
 * @returns Sanitized HTML with target="_blank" and rel="noopener noreferrer" on all links
 */
export function processArticleContent(
  content: string | null | undefined,
  opts: { title?: string } = {}
): string | null {
  if (!content) return null

  // Legacy full-text blobs are tag-less plain text — restore paragraphs
  if (looksLikePlainText(content)) {
    content = paragraphize(content)
  }

  // First, sanitize the HTML to prevent XSS attacks
  const sanitized = DOMPurify.sanitize(content, {
    ALLOWED_TAGS: [
      'p', 'br', 'strong', 'em', 'u', 'b', 'i', 's', 'sup', 'sub', 'a',
      'ul', 'ol', 'li', 'dl', 'dt', 'dd', 'hr',
      'blockquote', 'code', 'pre', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'img', 'figure', 'figcaption',
      'table', 'thead', 'tbody', 'tr', 'th', 'td', 'caption',
      'div', 'span'
    ],
    ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'class', 'srcset', 'sizes', 'loading']
  })

  // Create a temporary div to parse the sanitized HTML
  const div = document.createElement('div')
  div.innerHTML = sanitized

  // Deterministic junk removal + meta-text tagging (utils/cleanArticleContent.ts).
  // Runs on the sanitized DOM so display, RSVP, and read-aloud all see the
  // cleaned body; the stored article body is never mutated.
  cleanArticleDom(div, { title: opts.title })

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
