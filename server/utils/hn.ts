/**
 * Hacker News favorites → Found-feed items. HN favorites are PUBLIC
 * (news.ycombinator.com/favorites?id=<user>) but have no API, so the sync
 * scrapes item ids off the favorites page and hydrates each new id from
 * the official Firebase API (hacker-news.firebaseio.com/v0/item/<id>.json).
 * Pure parsing/rendering here — no h3/D1 imports; unit-tested in
 * __tests__/server/hn.test.ts.
 */

import type { FoundItem } from '~/server/utils/xRender'

/**
 * Extract story ids from a favorites page, in display order (newest-first).
 * Rows look like <tr class='athing submission' id='44001234'> — quoting
 * style varies, so accept both.
 */
export function parseFavoriteIds(html: string): string[] {
  const ids: string[] = []
  const re = /<tr[^>]*class=['"]athing[^'"]*['"][^>]*id=['"](\d+)['"]/g
  let m: RegExpExecArray | null
  while ((m = re.exec(html))) ids.push(m[1])
  return ids
}

/** True when the favorites page links to a further page ("More"). */
export function hasMoreFavorites(html: string): boolean {
  return /class=['"]morelink['"]/.test(html)
}

const esc = (s: any) =>
  String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/**
 * Render a Firebase item (type 'story'/'job'/'poll'; comments are skipped —
 * the favorites page defaults to stories) into a Found item. `item.text`
 * (Ask HN etc.) is already HTML from the API; DOMPurify at display time is
 * the security boundary, same as every other Found source.
 */
export function renderHnItem(item: any): FoundItem | null {
  if (!item || !item.id || item.type === 'comment' || item.deleted || item.dead) return null

  const hnUrl = `https://news.ycombinator.com/item?id=${item.id}`
  const external = item.url && /^https?:\/\//.test(item.url) ? item.url : null
  const date = item.time ? new Date(item.time * 1000).toISOString().slice(0, 10) : ''
  let host = ''
  if (external) {
    try {
      host = new URL(external).hostname.replace(/^www\./, '')
    } catch {}
  }

  const html = [
    `<p><strong>${esc(item.title || '')}</strong></p>`,
    `<p>${item.by ? `${esc(item.by)} · ` : ''}${item.score != null ? `${item.score} points · ` : ''}${date}</p>`,
    item.text || '',
    external ? `<p><a href="${esc(external)}">${esc(host || external)} →</a></p>` : '',
    `<p><a href="${esc(hnUrl)}">${item.descendants != null ? `${item.descendants} comments on` : 'View on'} Hacker News →</a></p>`,
  ].filter(Boolean).join('\n')

  const plainText = String(item.text || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()

  return {
    source: 'hn-favorite',
    externalId: String(item.id),
    // The card opens the story itself; the HN thread is linked in the body.
    url: external || hnUrl,
    title: item.title || `Hacker News item ${item.id}`,
    author: item.by || undefined,
    content: html,
    summary: plainText.slice(0, 280) || undefined,
    publishedAt: item.time ? new Date(item.time * 1000).toISOString() : undefined,
  }
}
