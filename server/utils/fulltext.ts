import { getD1 } from '~/server/utils/cloudflare'
import { storeArticleContent, fetchArticleContent } from '~/server/utils/article-content'
import { extractReadableContent, extractLeadImage, acceptExtraction } from '~/server/utils/extractContent'
import { updateFtsBody } from '~/server/utils/searchIndex'
import { rigForUrl } from '~/server/utils/feedRigs'

type FullTextResult = {
  status: 'fetched' | 'failed' | 'skipped'
  content?: string
  imageUrl?: string | null
  error?: string
}

export const fetchFullText = async (
  event: any,
  article: { id: number; url: string; contentKey?: string | null }
): Promise<FullTextResult> => {
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

    // Per-feed rig: a bespoke extractor for this host (server/utils/feedRigs/)
    // gets first go at the page — it knows the exact markup (comic + hovertext
    // + bonus panel, multi-page stories, …) and skips Readability entirely.
    // Fail-soft: a throw or null falls through to the generic path.
    const rig = rigForUrl(article.url)
    if (rig?.extract) {
      try {
        const rigged = await rig.extract({
          url: article.url,
          html,
          fetchPage: makeRigFetchPage(article.url)
        })
        if (rigged?.html?.trim()) {
          const image = rigged.imageUrl ?? extractLeadImage(html, article.url, rigged.html)
          return await storeFetchedBody(event, article.id, rigged.html, image)
        }
      } catch {
        // Rig bug — the generic extraction below still runs.
      }
    }

    const extracted = extractReadableContent(html, article.url)

    // We already hold the page HTML — backfill the card image when the RSS
    // item carried none (or only legacy Unsplash filler).
    const leadImage = extractLeadImage(html, article.url, extracted?.html)

    const existing = await fetchArticleContent(event, article.contentKey)

    let body: string
    if (extracted && acceptExtraction(extracted.html, existing, leadImage)) {
      body = extracted.html
    } else if (!existing?.trim() && leadImage) {
      // Image-led pages with no extractable prose (comics like Oglaf) and an
      // empty stored body: the lead image IS the article.
      body = `<p><img src="${leadImage.replace(/"/g, '&quot;')}" alt=""></p>`
    } else {
      // Keep the stored body — but still backfill the card image; the
      // page's og:image is worth having even when the body extraction isn't.
      const imageUrl = leadImage ? await backfillImage(event, article.id, leadImage) : null
      return {
        status: 'skipped',
        imageUrl,
        error: extracted ? 'Extraction looked worse than the stored body' : 'No extractable content'
      }
    }

    return await storeFetchedBody(event, article.id, body, leadImage)
  } catch (err: any) {
    return { status: 'failed', error: err.message || 'Unknown error' }
  }
}

/**
 * Store a fetched body in R2, mark the row fetched (backfilling the card
 * image when the row had none / only filler), and keep FTS in step.
 */
const storeFetchedBody = async (
  event: any,
  articleId: number,
  body: string,
  leadImage: string | null
): Promise<FullTextResult> => {
  const db = getD1(event)
  const contentKey = await storeArticleContent(event, articleId, body)
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
  ).bind(contentKey, leadImage, articleId).run()

  // Keep the search index in step with the upgraded body.
  await updateFtsBody(event, articleId, body)

  // Read back the effective image_url (the CASE above only backfills when the
  // row had none / only filler) so callers can update a card in place.
  const row = await db.prepare(
    'SELECT image_url FROM "Article" WHERE id = ?'
  ).bind(articleId).first<{ image_url: string | null }>()

  return { status: 'fetched', content: body, imageUrl: row?.image_url ?? null }
}

/**
 * Follow-up page fetcher handed to rig extractors (multi-page stories):
 * same-host only, 12-fetch budget, 15s timeout, HTML only. Resolves null on
 * any failure so rigs stay fail-soft.
 */
const makeRigFetchPage = (articleUrl: string) => {
  let budget = 12
  const articleHost = (() => {
    try {
      return new URL(articleUrl).hostname.replace(/^www\./, '')
    } catch {
      return null
    }
  })()

  return async (url: string): Promise<string | null> => {
    if (budget-- <= 0) return null
    try {
      const host = new URL(url).hostname.replace(/^www\./, '')
      if (!articleHost || host !== articleHost) return null
      const response = await fetch(url, {
        signal: AbortSignal.timeout(15000),
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; TheLibrarian/1.0; RSS Reader)',
          'Accept': 'text/html,application/xhtml+xml'
        }
      })
      if (!response.ok) return null
      const contentType = response.headers.get('content-type') || ''
      if (!contentType.includes('text/html') && !contentType.includes('application/xhtml')) return null
      return await response.text()
    } catch {
      return null
    }
  }
}

/**
 * Backfill image_url from the page's lead image when the row has none (or
 * only legacy Unsplash filler); returns the effective image_url.
 */
const backfillImage = async (event: any, articleId: number, leadImage: string) => {
  const db = getD1(event)
  await db.prepare(
    `UPDATE "Article"
     SET image_url = ?1
     WHERE id = ?2 AND (image_url IS NULL OR image_url = '' OR image_url LIKE '%.unsplash.com%')`
  ).bind(leadImage, articleId).run()
  const row = await db.prepare(
    'SELECT image_url FROM "Article" WHERE id = ?'
  ).bind(articleId).first<{ image_url: string | null }>()
  return row?.image_url ?? null
}

export const updateFullTextStatus = async (event: any, articleId: number, status: string, error?: string) => {
  const db = getD1(event)
  await db.prepare(
    `UPDATE "Article" SET full_text_status = ?, full_text_error = ? WHERE id = ?`
  ).bind(status, error || null, articleId).run()
}
