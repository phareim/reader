import { getD1 } from '~/server/utils/cloudflare'
import { storeArticleContent } from '~/server/utils/article-content'
import { extractReadableContent } from '~/server/utils/extractContent'

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
    const extracted = extractReadableContent(html, article.url)

    if (!extracted) {
      return { status: 'skipped', error: 'No extractable content' }
    }

    // Store in R2 and update D1
    const db = getD1(event)
    const contentKey = await storeArticleContent(event, article.id, extracted.html)
    await db.prepare(
      `UPDATE "Article" SET full_text_status = 'fetched', full_text_error = NULL, content_key = ? WHERE id = ?`
    ).bind(contentKey, article.id).run()

    return { status: 'fetched', content: extracted.html }
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
