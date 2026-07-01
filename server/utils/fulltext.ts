import { getD1 } from '~/server/utils/cloudflare'
import { storeArticleContent } from '~/server/utils/article-content'
import { extractReadableContent, extractLeadImage } from '~/server/utils/extractContent'

type FullTextResult = {
  status: 'fetched' | 'failed' | 'skipped'
  content?: string
  imageUrl?: string | null
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

    // We already hold the page HTML — backfill the card image when the RSS
    // item carried none (or only legacy Unsplash filler).
    const leadImage = extractLeadImage(html, article.url, extracted.html)

    // Store in R2 and update D1
    const db = getD1(event)
    const contentKey = await storeArticleContent(event, article.id, extracted.html)
    await db.prepare(
      `UPDATE "Article"
       SET full_text_status = 'fetched',
           full_text_error = NULL,
           content_key = ?1,
           image_url = CASE
             WHEN ?2 IS NOT NULL AND (image_url IS NULL OR image_url = '' OR image_url LIKE '%.unsplash.com%')
             THEN ?2
             ELSE image_url
           END
       WHERE id = ?3`
    ).bind(contentKey, leadImage, article.id).run()

    // Read back the effective image_url (the CASE above only backfills when the
    // row had none / only filler) so callers can update a card in place.
    const row = await db.prepare(
      'SELECT image_url FROM "Article" WHERE id = ?'
    ).bind(article.id).first<{ image_url: string | null }>()

    return { status: 'fetched', content: extracted.html, imageUrl: row?.image_url ?? null }
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
