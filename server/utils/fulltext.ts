import { getD1 } from '~/server/utils/cloudflare'
import { storeArticleContent } from '~/server/utils/article-content'

type FullTextResult = {
  status: 'fetched' | 'failed' | 'skipped'
  content?: string
  error?: string
}

export const fetchFullText = async (event: any, article: { id: number; url: string }): Promise<FullTextResult> => {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 15000)

    let response: Response
    try {
      response = await fetch(article.url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; TheLibrarian/1.0; RSS Reader)',
          'Accept': 'text/html,application/xhtml+xml'
        }
      })
    } catch (err: any) {
      clearTimeout(timeout)
      if (err.name === 'AbortError') {
        return { status: 'failed', error: 'Request timed out (15s)' }
      }
      return { status: 'failed', error: `Fetch error: ${err.message}` }
    }
    clearTimeout(timeout)

    if (!response.ok) {
      return { status: 'skipped', error: `HTTP ${response.status}` }
    }

    const contentType = response.headers.get('content-type') || ''
    if (!contentType.includes('text/html') && !contentType.includes('application/xhtml')) {
      return { status: 'skipped', error: `Not HTML: ${contentType}` }
    }

    const html = await response.text()
    const extracted = extractReadableContent(html)

    if (!extracted || extracted.length < 200) {
      return { status: 'skipped', error: 'No extractable content' }
    }

    // Store in R2 and update D1
    const db = getD1(event)
    const contentKey = await storeArticleContent(event, article.id, extracted)
    await db.prepare(
      `UPDATE "Article" SET full_text_status = 'fetched', full_text_error = NULL, content_key = ? WHERE id = ?`
    ).bind(contentKey, article.id).run()

    return { status: 'fetched', content: extracted }
  } catch (err: any) {
    return { status: 'failed', error: err.message || 'Unknown error' }
  }
}

export const updateFullTextStatus = async (event: any, articleId: number, status: string, error?: string) => {
  const db = getD1(event)
  await db.prepare(
    `UPDATE "Article" SET full_text_status = ?, full_text_error = ? WHERE id = ?`
  ).bind(status, error || null, articleId).run()
}

function extractReadableContent(html: string): string {
  // Remove script, style, nav, footer, aside, header tags and their contents
  let cleaned = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '')
    .replace(/<aside[\s\S]*?<\/aside>/gi, '')
    .replace(/<header[\s\S]*?<\/header>/gi, '')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, '')
    .replace(/<form[\s\S]*?<\/form>/gi, '')

  // Try to extract <article> content first
  const articleMatch = cleaned.match(/<article[\s\S]*?>([\s\S]*?)<\/article>/i)
  if (articleMatch) {
    cleaned = articleMatch[1]
  } else {
    // Fall back to <main> content
    const mainMatch = cleaned.match(/<main[\s\S]*?>([\s\S]*?)<\/main>/i)
    if (mainMatch) {
      cleaned = mainMatch[1]
    } else {
      // Fall back to body
      const bodyMatch = cleaned.match(/<body[\s\S]*?>([\s\S]*?)<\/body>/i)
      if (bodyMatch) {
        cleaned = bodyMatch[1]
      }
    }
  }

  // Keep paragraph and heading content, strip remaining tags
  // First, preserve paragraph breaks
  cleaned = cleaned
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/h[1-6]>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/li>/gi, '\n')

  // Strip all remaining HTML tags
  cleaned = cleaned.replace(/<[^>]+>/g, '')

  // Decode common HTML entities
  cleaned = cleaned
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/')

  // Clean up whitespace
  cleaned = cleaned
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n\s*\n/g, '\n\n')
    .trim()

  return cleaned
}
