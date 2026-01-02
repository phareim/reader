/**
 * Server-side HTML processing utilities
 * Node.js doesn't have DOM APIs, so we use regex-based stripping
 */

/**
 * Removes all HTML tags from a string
 */
export function stripHtmlTags(html: string): string {
  if (!html) return ''

  let text = html

  // Remove script and style elements with their content
  text = text.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
  text = text.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')

  // Remove HTML tags
  text = text.replace(/<[^>]+>/g, '')

  // Decode common HTML entities
  text = decodeHtmlEntities(text)

  // Normalize whitespace
  text = text.replace(/\s+/g, ' ').trim()

  return text
}

/**
 * Extracts text content with length limit
 */
export function extractTextContent(html: string, maxLength: number): string {
  if (!html) return ''

  const text = stripHtmlTags(html)

  if (text.length <= maxLength) {
    return text
  }

  // Truncate at word boundary
  const truncated = text.substring(0, maxLength)
  const lastSpace = truncated.lastIndexOf(' ')

  if (lastSpace > maxLength * 0.8) {
    // If we're at least 80% of the way, truncate at last space
    return truncated.substring(0, lastSpace) + '...'
  }

  return truncated + '...'
}

/**
 * Decode common HTML entities
 */
function decodeHtmlEntities(text: string): string {
  const entities: Record<string, string> = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'",
    '&apos;': "'",
    '&nbsp;': ' ',
    '&ndash;': '–',
    '&mdash;': '—',
    '&hellip;': '...',
    '&ldquo;': '"',
    '&rdquo;': '"',
    '&lsquo;': "'",
    '&rsquo;': "'",
  }

  let decoded = text

  // Replace named entities
  for (const [entity, char] of Object.entries(entities)) {
    decoded = decoded.replace(new RegExp(entity, 'g'), char)
  }

  // Replace numeric entities (&#123; or &#x1A2B;)
  decoded = decoded.replace(/&#(\d+);/g, (match, dec) => {
    return String.fromCharCode(parseInt(dec, 10))
  })

  decoded = decoded.replace(/&#x([0-9a-f]+);/gi, (match, hex) => {
    return String.fromCharCode(parseInt(hex, 16))
  })

  return decoded
}
