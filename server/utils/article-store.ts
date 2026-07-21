import { getD1 } from '~/server/utils/cloudflare'
import { storeArticleContent } from '~/server/utils/article-content'
import { lastRowId, rowsChanged } from '~/server/utils/d1Result'
import { normalizeUrl } from '~/server/utils/urlNormalize'
import { indexArticleFts } from '~/server/utils/searchIndex'

type ArticleInsert = {
  guid: string
  title: string
  url: string
  author?: string | null
  content?: string | null
  summary?: string | null
  imageUrl?: string | null
  publishedAt?: Date | string | null
  source?: string | null
  // Insert already marked read — used for cross-source URL-dedup tombstones:
  // the guid gets recorded (so sync paging sees the item as known) but the
  // card never surfaces as unread.
  markRead?: boolean
  // The feed body IS the article (set by per-feed rigs for link-blogs like
  // Daring Fireball, where the article URL points at the *linked* page and a
  // full-text fetch would overwrite the author's commentary with it). Inserts
  // with full_text_status='skipped' so the fetch never fires.
  fullTextComplete?: boolean
}

export const insertArticleWithContent = async (event: any, feedId: number, item: ArticleInsert) => {
  const db = getD1(event)
  const publishedAt = item.publishedAt
    ? (item.publishedAt instanceof Date ? item.publishedAt.toISOString() : item.publishedAt)
    : null

  const insert = await db.prepare(
    `
    INSERT OR IGNORE INTO "Article" (
      feed_id,
      guid,
      title,
      url,
      author,
      summary,
      image_url,
      published_at,
      source,
      url_norm,
      is_read,
      read_at,
      full_text_status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
  ).bind(
    feedId,
    item.guid,
    item.title,
    item.url,
    item.author || null,
    item.summary || null,
    item.imageUrl || null,
    publishedAt,
    item.source || null,
    normalizeUrl(item.url),
    item.markRead ? 1 : 0,
    item.markRead ? new Date().toISOString() : null,
    item.fullTextComplete ? 'skipped' : 'pending'
  ).run()

  const articleId = lastRowId(insert)
  if (!rowsChanged(insert) || !articleId) {
    return { inserted: false, id: null }
  }

  if (item.content) {
    const contentKey = await storeArticleContent(event, articleId, item.content)
    await db.prepare(
      'UPDATE "Article" SET content_key = ? WHERE id = ?'
    ).bind(contentKey, articleId).run()
  }

  // Read tombstones (URL-dedup shadows) stay out of the search index.
  if (!item.markRead) {
    await indexArticleFts(event, {
      id: articleId,
      title: item.title,
      summary: item.summary,
      bodyHtml: item.content
    })
  }

  return { inserted: true, id: articleId }
}
