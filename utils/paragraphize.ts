/**
 * Plain-text helpers shared by the server extraction fallback and the
 * client renderer. Legacy full-text blobs in R2 are tag-less plain text;
 * these turn them into minimal paragraphed HTML.
 */

/** True when content contains no HTML tags (legacy plain-text R2 blobs). */
export function looksLikePlainText(content: string): boolean {
  return !/<[a-z][^>]*>/i.test(content)
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

/**
 * Wrap blank-line-separated blocks in <p>, single newlines become <br>.
 * Escapes &, <, > first — legacy blobs were entity-decoded at storage time,
 * so a stray angle bracket would otherwise parse as a tag and be eaten by
 * the sanitizer.
 */
export function paragraphize(text: string): string {
  const blocks = text
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter((block) => block.length > 0)

  return blocks
    .map((block) => `<p>${escapeHtml(block).replace(/\n/g, '<br>')}</p>`)
    .join('\n')
}
