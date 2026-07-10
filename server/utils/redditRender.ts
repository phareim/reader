/**
 * Pure rendering of Reddit saved-listing children → Found-feed items.
 * Ported from scripts/reddit-saved-sync.mjs (the never-enabled Sleeper-side
 * collector) for the Worker-side sync. Expects listings fetched with
 * raw_json=1 so selftext_html/body_html arrive un-entity-encoded. No h3/D1
 * imports — unit-tested directly in __tests__/server/redditRender.test.ts.
 */

import type { FoundItem } from '~/server/utils/xRender'

const esc = (s: any) =>
  String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const permaUrl = (p: string | null | undefined) => (p ? `https://www.reddit.com${p}` : null)
const isHttp = (u: any) => typeof u === 'string' && /^https?:\/\//.test(u)

function leadImage(d: any): string | null {
  const src = d.preview?.images?.[0]?.source?.url // raw_json=1 → not entity-encoded
  if (isHttp(src)) return src
  if (isHttp(d.thumbnail)) return d.thumbnail
  if (isHttp(d.url) && /\.(jpe?g|png|gif|webp)$/i.test(d.url)) return d.url
  return null
}

// Render a saved POST (t3).
function renderPost(d: any): FoundItem {
  const sub = d.subreddit_name_prefixed || (d.subreddit ? `r/${d.subreddit}` : '')
  const date = d.created_utc ? new Date(d.created_utc * 1000).toISOString().slice(0, 10) : ''
  const img = leadImage(d)
  const linksOut = !d.is_self && isHttp(d.url) && !/\.(jpe?g|png|gif|webp)$/i.test(d.url)

  const html = [
    `<p><strong>${esc(d.title || '')}</strong></p>`,
    `<p>${esc(sub)}${d.author ? ` · u/${esc(d.author)}` : ''}${date ? ` · ${date}` : ''}</p>`,
    d.selftext_html || '', // real HTML with raw_json=1
    img ? `<p><img src="${esc(img)}" alt=""></p>` : '',
    linksOut ? `<p><a href="${esc(d.url)}">${esc(d.domain || d.url)} →</a></p>` : '',
    `<p><a href="${esc(permaUrl(d.permalink))}">View on Reddit →</a></p>`,
  ].filter(Boolean).join('\n')

  const title = (d.title || `${sub} post`).slice(0, 200)
  return {
    source: 'reddit',
    externalId: d.name, // fullname e.g. t3_abc123
    url: permaUrl(d.permalink) || d.url,
    title,
    author: d.author ? `u/${d.author}` : undefined,
    content: html,
    summary: (d.selftext || d.title || '').replace(/\s+/g, ' ').trim().slice(0, 280) || undefined,
    imageUrl: img || undefined,
    publishedAt: d.created_utc ? new Date(d.created_utc * 1000).toISOString() : undefined,
  }
}

// Render a saved COMMENT (t1).
function renderComment(d: any): FoundItem {
  const sub = d.subreddit_name_prefixed || (d.subreddit ? `r/${d.subreddit}` : '')
  const date = d.created_utc ? new Date(d.created_utc * 1000).toISOString().slice(0, 10) : ''
  const onPost = d.link_title ? `<p>Comment on “${esc(d.link_title)}”</p>` : ''
  const bodyText = (d.body || '').replace(/\s+/g, ' ').trim()

  const html = [
    `<p>${esc(sub)}${d.author ? ` · u/${esc(d.author)}` : ''}${date ? ` · ${date}` : ''}</p>`,
    onPost,
    d.body_html || (bodyText ? `<blockquote><p>${esc(bodyText)}</p></blockquote>` : ''),
    `<p><a href="${esc(permaUrl(d.permalink))}">View on Reddit →</a></p>`,
  ].filter(Boolean).join('\n')

  const titleBase = d.link_title ? `Comment on ${d.link_title}` : bodyText || `${sub} comment`
  return {
    source: 'reddit',
    externalId: d.name, // fullname e.g. t1_xyz789
    url: permaUrl(d.permalink) || permaUrl(d.link_permalink),
    title: titleBase.slice(0, 200),
    author: d.author ? `u/${d.author}` : undefined,
    content: html,
    summary: bodyText.slice(0, 280) || undefined,
    publishedAt: d.created_utc ? new Date(d.created_utc * 1000).toISOString() : undefined,
  }
}

/** Render one child of a saved listing; null for unrenderable/foreign kinds. */
export function renderRedditChild(child: any): FoundItem | null {
  const d = child?.data
  if (!d || !d.name) return null
  if (child.kind === 't3') return d.permalink ? renderPost(d) : null
  if (child.kind === 't1') return d.permalink || d.link_permalink ? renderComment(d) : null
  return null // other kinds (rare in saved) — skip
}
