import { getD1 } from '~/server/utils/cloudflare'
import { rowsChanged } from '~/server/utils/d1Result'
import { stripHtml } from '~/utils/cardData'

/**
 * ArticleFts maintenance (migration 014) — the search index over article
 * title / summary / body text, rowid = Article.id. All writers are
 * best-effort: a search-index failure must never fail the article write
 * it rides along with.
 */

// Bodies are capped so a pathological page can't bloat D1; 60k chars of
// visible text is far past where relevance stops improving.
export const FTS_BODY_MAX = 60_000

// snippet() match markers — private-use-area chars that cannot appear in
// real text; the client swaps them for <mark> after HTML-escaping.
export const SNIPPET_OPEN = '\uE000'
export const SNIPPET_CLOSE = '\uE001'

const toText = (html?: string | null) =>
  html ? stripHtml(html).slice(0, FTS_BODY_MAX) : ''

/** Insert or fully replace an article's index row. */
export async function indexArticleFts(
  event: any,
  article: { id: number; title: string; summary?: string | null; bodyHtml?: string | null }
): Promise<void> {
  try {
    const db = getD1(event)
    await db.prepare('DELETE FROM "ArticleFts" WHERE rowid = ?').bind(article.id).run()
    await db.prepare(
      'INSERT INTO "ArticleFts" (rowid, title, summary, body) VALUES (?, ?, ?, ?)'
    ).bind(article.id, article.title || '', toText(article.summary), toText(article.bodyHtml)).run()
  } catch (err: any) {
    console.error(`FTS index failed for article ${article.id}:`, err.message)
  }
}

/**
 * Refresh just the body column (the full-text fetch path). Falls back to a
 * full insert when the article predates the index.
 */
export async function updateFtsBody(event: any, articleId: number, bodyHtml: string): Promise<void> {
  try {
    const db = getD1(event)
    const result = await db.prepare(
      'UPDATE "ArticleFts" SET body = ? WHERE rowid = ?'
    ).bind(toText(bodyHtml), articleId).run()
    if (!rowsChanged(result)) {
      const row = await db.prepare(
        'SELECT title, summary FROM "Article" WHERE id = ?'
      ).bind(articleId).first<{ title: string; summary: string | null }>()
      if (row) {
        await indexArticleFts(event, { id: articleId, title: row.title, summary: row.summary, bodyHtml })
      }
    }
  } catch (err: any) {
    console.error(`FTS body update failed for article ${articleId}:`, err.message)
  }
}

/** Remove index rows (FTS tables don't cascade with Article deletes). */
export async function deleteFtsRows(event: any, articleIds: number[]): Promise<void> {
  if (!articleIds.length) return
  try {
    const db = getD1(event)
    const placeholders = articleIds.map(() => '?').join(',')
    await db.prepare(
      `DELETE FROM "ArticleFts" WHERE rowid IN (${placeholders})`
    ).bind(...articleIds).run()
  } catch (err: any) {
    console.error('FTS delete failed:', err.message)
  }
}

/**
 * User text → FTS5 MATCH expression. Every token is quoted (so FTS syntax
 * characters can't leak through) and AND-ed; the last token matches as a
 * prefix so results appear while a word is still being typed. Null when
 * nothing searchable remains.
 */
export function buildFtsQuery(q: string): string | null {
  const tokens = q
    .split(/\s+/)
    .map((t) => t.replace(/"/g, '').trim())
    .filter(Boolean)
    .slice(0, 8)
  if (!tokens.length) return null
  return tokens
    .map((t, i) => (i === tokens.length - 1 ? `"${t}"*` : `"${t}"`))
    .join(' ')
}
