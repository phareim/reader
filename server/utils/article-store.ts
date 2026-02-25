import { getD1 } from '~/server/utils/cloudflare'
import { storeArticleContent } from '~/server/utils/article-content'

type ArticleInsert = {
  guid: string
  title: string
  url: string
  author?: string | null
  content?: string | null
  summary?: string | null
  imageUrl?: string | null
  publishedAt?: Date | string | null
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
      published_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `
  ).bind(
    feedId,
    item.guid,
    item.title,
    item.url,
    item.author || null,
    item.summary || null,
    item.imageUrl || null,
    publishedAt
  ).run()

  if (!insert.changes || !insert.lastRowId) {
    return { inserted: false, id: null }
  }

  if (item.content) {
    const contentKey = await storeArticleContent(event, insert.lastRowId, item.content)
    await db.prepare(
      'UPDATE "Article" SET content_key = ? WHERE id = ?'
    ).bind(contentKey, insert.lastRowId).run()
  }

  return { inserted: true, id: insert.lastRowId }
}
