/**
 * Inline-hashtag helpers, shared by the highlight note overlay (client) and
 * the highlight POST route (server). Pure — no DOM, no Nuxt imports.
 *
 * A note like "a surprisingly good take on #programming, even in the 30's"
 * carries `#programming` as an inline tag: the word stays visible in the note
 * AND is promoted to a real SFL tag on the quote idea.
 */

// A hashtag is `#` followed by one or more letters/numbers/underscore/hyphen.
// Unicode-aware so Norwegian (#påske) and others work. The `#` must not be
// glued to a preceding word character (so URLs like `a#b` don't tag).
const HASHTAG_RE = /(^|[^\p{L}\p{N}_])#([\p{L}\p{N}_-]+)/gu

/**
 * Extract the distinct tag names from a note (without the leading `#`),
 * lowercased and de-duplicated, preserving first-seen order. A trailing
 * hyphen is trimmed so "#the-30's" → "the-30" not "the-30-".
 */
export function extractHashtags(text: string | null | undefined): string[] {
  if (!text) return []
  const seen = new Set<string>()
  const out: string[] = []
  for (const m of text.matchAll(HASHTAG_RE)) {
    const name = m[2].replace(/-+$/, '').toLowerCase()
    if (!name || seen.has(name)) continue
    seen.add(name)
    out.push(name)
  }
  return out
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * Render a note as safe HTML with `#hashtags` wrapped in an accent span.
 * Escapes everything first, so the result is safe to inject. Used by the
 * highlight popover to show the saved note.
 */
export function renderNoteHtml(text: string | null | undefined): string {
  if (!text) return ''
  // Escape, THEN wrap — the regex runs over escaped text, where `#word` is
  // unaffected by escaping (it has no HTML-special chars).
  return escapeHtml(text).replace(
    HASHTAG_RE,
    (_full, pre: string, name: string) =>
      `${pre}<span class="note-tag">#${name}</span>`,
  )
}
