/**
 * Lead-image extraction from a raw feed entry. Pure (no D1/R2/h3 imports)
 * so Jest tests it directly (__tests__/server/feedImage.test.ts).
 *
 * feed-extractor parses XML with fast-xml-parser (`attributeNamePrefix: '@_'`),
 * so element attributes arrive as `@_url` / `@_type` / `@_href` — NOT the
 * xml2js `$.url` shape rss-parser used. Repeated elements arrive as arrays.
 */

function asArray(value: any): any[] {
  if (value === undefined || value === null) return []
  return Array.isArray(value) ? value : [value]
}

function attr(node: any, name: string): string | undefined {
  if (!node || typeof node !== 'object') return undefined
  const value = node[`@_${name}`]
  return typeof value === 'string' && value ? value : undefined
}

/**
 * Pick an image URL from a media:content / media:thumbnail node (or list).
 * Accepts nodes explicitly marked as images (`medium="image"` or an image/*
 * type), or unmarked nodes (many news feeds ship media:content with only a
 * url). Nodes marked as something else (e.g. YouTube's video media:content)
 * are rejected.
 */
function mediaUrl(value: any): string | undefined {
  const nodes = asArray(value)
  const isImage = (node: any) => {
    const type = attr(node, 'type')
    const medium = attr(node, 'medium')
    if (medium) return medium === 'image'
    if (type) return type.startsWith('image/')
    return true
  }
  const candidate = nodes.find((node) => attr(node, 'url') && isImage(node))
  return attr(candidate, 'url')
}

/**
 * Extract image URL from a raw feed entry using multiple strategies.
 * Returns undefined when no image is found — callers must not substitute
 * a stock-photo service; imageUrl should simply be absent.
 */
export function extractImageUrl(item: any, rawContent?: string): string | undefined {
  // 1. Enclosure, when it is an image
  for (const enclosure of asArray(item.enclosure)) {
    const type = attr(enclosure, 'type') || ''
    const url = attr(enclosure, 'url')
    if (url && type.startsWith('image/')) return url
  }

  // 2. media:content / media:thumbnail — directly on the entry or inside
  //    media:group (YouTube nests both under the group)
  const direct = mediaUrl(item.mediaContent) || mediaUrl(item.mediaThumbnail)
  if (direct) return direct
  for (const group of asArray(item.mediaGroup)) {
    const grouped = mediaUrl(group?.['media:content']) || mediaUrl(group?.['media:thumbnail'])
    if (grouped) return grouped
  }

  // 3. itunes:image
  const itunesImage = asArray(item.itunesImage).map((node) => attr(node, 'href')).find(Boolean)
  if (itunesImage) return itunesImage
  if (typeof item.itunes?.image === 'string' && item.itunes.image) {
    return item.itunes.image
  }

  // 4. First <img> tag in the HTML content
  if (rawContent) {
    const imgMatch = rawContent.match(/<img[^>]+src=["']([^"']+)["']/i)
    if (imgMatch?.[1]) {
      return imgMatch[1]
    }
  }

  return undefined
}
