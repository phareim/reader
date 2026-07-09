/**
 * Charset resolution for feed bodies. Pure (unit-tested).
 *
 * feed-extractor's internal fetch parses the Content-Type charset with a
 * greedy match, so a header like
 *   application/xml; charset=ISO-8859-1; filename=feed.xml   (The Oatmeal)
 * yields the "encoding" `ISO-8859-1; filename=feed.xml` and throws. We
 * fetch feed bodies ourselves and split parameters properly instead.
 */

/** Parse the charset parameter out of a Content-Type header value. */
export function charsetFromContentType(contentType: string | null | undefined): string {
  if (!contentType) return 'utf-8'
  for (const param of contentType.split(';').slice(1)) {
    const eq = param.indexOf('=')
    if (eq === -1) continue
    const key = param.slice(0, eq).trim().toLowerCase()
    if (key !== 'charset') continue
    const value = param.slice(eq + 1).trim().replace(/^["']|["']$/g, '')
    return value || 'utf-8'
  }
  return 'utf-8'
}

/** Decode a feed body with the header charset, falling back to UTF-8 when
 *  the label is unknown to TextDecoder. */
export function decodeFeedBody(buffer: ArrayBuffer, contentType: string | null | undefined): string {
  const charset = charsetFromContentType(contentType)
  try {
    return new TextDecoder(charset).decode(buffer)
  } catch {
    return new TextDecoder('utf-8').decode(buffer)
  }
}
