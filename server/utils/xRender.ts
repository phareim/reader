/**
 * Pure rendering of X (Twitter) bookmark payloads → Found-feed items.
 * Ported from scripts/x-bookmark-sync.mjs (the retired Sleeper-side
 * collector) so the Worker-side sync renders identically. No h3/D1
 * imports — unit-tested directly in __tests__/server/xRender.test.ts.
 */

export type XIncludeMaps = {
  usersById: Map<string, any>
  tweetsById: Map<string, any>
  mediaByKey: Map<string, any>
}

export type FoundItem = {
  source: string
  externalId: string
  url: string
  title: string
  author?: string
  content: string
  summary?: string
  imageUrl?: string
  publishedAt?: string
}

export function buildIncludeMaps(includes: any): XIncludeMaps {
  return {
    usersById: new Map((includes?.users || []).map((u: any) => [u.id, u])),
    tweetsById: new Map((includes?.tweets || []).map((t: any) => [t.id, t])),
    mediaByKey: new Map((includes?.media || []).map((m: any) => [m.media_key, m])),
  }
}

const esc = (s: any) =>
  String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const paras = (t: string) =>
  esc(t).split(/\n{2,}/).map((p) => `<p>${p.replace(/\n/g, '<br>')}</p>`).join('\n')

// Native X Article bodies (`article.plain_text`) separate blocks with a single
// \n and carry no structure. Detect headings heuristically: a short, few-word
// line that doesn't end in sentence/clause punctuation (body paragraphs run
// long and end in '.' or a closing quote). DOMPurify's allowlist passes <h2>.
const TERMINAL = new Set(['.', ',', ':', ';', '!', '?', ')', '”', '"', '’', "'"])
const looksHeading = (s: string) =>
  s.length <= 70 && s.split(/\s+/).length <= 10 && !TERMINAL.has(s.slice(-1))
const articleBody = (t: string) =>
  String(t || '').split(/\n+/).map((l) => l.trim()).filter(Boolean)
    .map((l) => (looksHeading(l) ? `<h2>${esc(l)}</h2>` : `<p>${esc(l)}</p>`)).join('\n')
const mediaUrl = (m: any) => (m ? m.url || m.preview_image_url : null)

// Render a native X Article bookmark (long-form) from the `article` field.
function renderArticle(t: any, { usersById, mediaByKey }: XIncludeMaps): FoundItem {
  const author = usersById.get(t.author_id) || {}
  const handle = author.username ? `@${author.username}` : t.author_id
  const date = t.created_at ? new Date(t.created_at).toISOString().slice(0, 10) : ''
  const a = t.article || {}
  const statusUrl = `https://x.com/${author.username || 'i'}/status/${t.id}`

  const cover = mediaByKey.get(a.cover_media)
  const coverUrl = mediaUrl(cover)
  const inline = (a.media_entities || [])
    .filter((k: string) => k !== a.cover_media)
    .map((k: string) => mediaUrl(mediaByKey.get(k))).filter(Boolean)
    .map((u: string) => `<p><img src="${esc(u)}"></p>`).join('\n')

  const html = [
    `<p><strong>${esc(handle)}</strong>${author.name ? ` · ${esc(author.name)}` : ''}${date ? ` · ${date}` : ''}</p>`,
    coverUrl ? `<p><img src="${esc(coverUrl)}" alt="${esc(a.title || '')}"></p>` : '',
    articleBody(a.plain_text || ''),
    inline,
    `<p><a href="${esc(statusUrl)}">View on X →</a></p>`,
  ].filter(Boolean).join('\n')

  const title = (a.title || '').replace(/\s+/g, ' ').trim() || `${handle} on X`
  const summary =
    a.preview_text?.trim() || (a.plain_text || '').replace(/\s+/g, ' ').trim().slice(0, 280)
  const leadImg =
    coverUrl ||
    (a.media_entities || []).map((k: string) => mediaUrl(mediaByKey.get(k))).find(Boolean) ||
    null

  return {
    source: 'x-bookmark',
    externalId: t.id,
    url: statusUrl,
    title,
    author: author.username ? `@${author.username}` : undefined,
    content: html,
    summary: summary || undefined,
    imageUrl: leadImg || undefined,
    publishedAt: t.created_at || undefined,
  }
}

// Render a bookmark (+ its quoted/replied context, all from `includes`) to HTML.
export function renderTweet(t: any, maps: XIncludeMaps): FoundItem {
  if (t.article) return renderArticle(t, maps)
  const { usersById, tweetsById, mediaByKey } = maps
  const author = usersById.get(t.author_id) || {}
  const handle = author.username ? `@${author.username}` : t.author_id
  const text = t.note_tweet?.text || t.text || ''
  const date = t.created_at ? new Date(t.created_at).toISOString().slice(0, 10) : ''

  const refs = t.referenced_tweets || []
  const repliedTo = refs.find((r: any) => r.type === 'replied_to')
  const quoted = refs.find((r: any) => r.type === 'quoted')

  const mediaImgs = (t.attachments?.media_keys || [])
    .map((k: string) => mediaByKey.get(k)).filter(Boolean)
    .map((m: any) => {
      const u = m.url || m.preview_image_url
      return u ? `<p><img src="${esc(u)}" alt="${esc(m.alt_text || '')}"></p>` : ''
    })
    .join('\n')

  const ctxBlock = (ref: any, labelPrefix: string) => {
    const rt = ref && tweetsById.get(ref.id)
    if (!rt) return ''
    const ra = usersById.get(rt.author_id) || {}
    const rh = ra.username ? `@${ra.username}` : ''
    const body = paras(rt.note_tweet?.text || rt.text || '')
    return `<blockquote><p><strong>${labelPrefix} ${esc(rh)}</strong></p>\n${body}</blockquote>`
  }

  const links = (t.entities?.urls || [])
    .filter(
      (u: any) =>
        u.expanded_url &&
        !/\/(photo|video)\/\d/.test(u.expanded_url) &&
        !u.expanded_url.includes('/status/')
    )
    .map((u: any) => `<a href="${esc(u.expanded_url)}">${esc(u.display_url || u.expanded_url)}</a>`)
  const uniqLinks = [...new Set(links)]

  const html = [
    `<p><strong>${esc(handle)}</strong>${author.name ? ` · ${esc(author.name)}` : ''}${date ? ` · ${date}` : ''}</p>`,
    repliedTo ? ctxBlock(repliedTo, '↳ Replying to') : '',
    paras(text),
    mediaImgs,
    quoted ? ctxBlock(quoted, '❝ Quoting') : '',
    uniqLinks.length ? `<p>${uniqLinks.join(' · ')}</p>` : '',
    `<p><a href="https://x.com/${esc(author.username || 'i')}/status/${esc(t.id)}">View on X →</a></p>`,
  ].filter(Boolean).join('\n')

  const titleText = text.replace(/\s+/g, ' ').trim()
  const title = titleText
    ? titleText.length > 90 ? titleText.slice(0, 89) + '…' : titleText
    : `${handle} on X`
  const leadImg =
    (t.attachments?.media_keys || [])
      .map((k: string) => mediaByKey.get(k)).filter(Boolean)
      .map((m: any) => m.url || m.preview_image_url).find(Boolean) || null

  return {
    source: 'x-bookmark',
    externalId: t.id,
    url: `https://x.com/${author.username || 'i'}/status/${t.id}`,
    title,
    author: author.username ? `@${author.username}` : undefined,
    content: html,
    summary: titleText ? titleText.slice(0, 280) : undefined,
    imageUrl: leadImg || undefined,
    publishedAt: t.created_at || undefined,
  }
}
