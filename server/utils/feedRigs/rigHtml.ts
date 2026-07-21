import { decodeEntities } from '~/server/utils/htmlEntities'

/** Escape text for safe embedding in rig-built HTML (text or attribute position). */
export const escapeHtml = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** The full opening tag of `<tagName … id="id" …>`, any attribute order. */
export function tagWithId(html: string, tagName: string, id: string): string | null {
  const re = new RegExp(`<${tagName}\\b[^>]*\\bid=["']${id}["'][^>]*>`, 'i')
  return html.match(re)?.[0] ?? null
}

/** One attribute off an opening tag (either quote style), entity-decoded. */
export function attrOf(tag: string, name: string): string | null {
  const m = tag.match(new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, 'i'))
  const raw = m ? (m[2] ?? m[3]) : null
  const decoded = raw != null ? decodeEntities(raw).trim() : null
  return decoded || null
}

/** The markup between an `id="id"` element's opening tag and its next `</div>`. */
export function sectionAfterId(html: string, id: string, windowLen = 2000): string | null {
  const tag = tagWithId(html, '[a-z]+', id)
  if (!tag) return null
  const start = html.indexOf(tag) + tag.length
  const window = html.slice(start, start + windowLen)
  const end = window.search(/<\/div>/i)
  return end === -1 ? window : window.slice(0, end)
}

/** href of the page's `rel="next"` link (`<a>` or head `<link>`), if any. */
export function nextLinkHref(html: string): string | null {
  const tag = html.match(/<(?:a|link)\b[^>]*\brel=["']next["'][^>]*>/i)?.[0]
  return tag ? attrOf(tag, 'href') : null
}

/** Resolve a possibly-relative URL against a base; null when unresolvable or non-http. */
export function absoluteUrl(src: string, baseUrl: string): string | null {
  try {
    const resolved = new URL(src, baseUrl)
    return resolved.protocol === 'http:' || resolved.protocol === 'https:' ? resolved.href : null
  } catch {
    return null
  }
}
