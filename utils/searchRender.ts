/**
 * Render a search snippet as safe HTML. The server marks matched terms with
 * private-use-area sentinels (SNIPPET_OPEN/CLOSE in server/utils/
 * searchIndex.ts) that cannot appear in real text; everything else is
 * escaped first, then the sentinels become <mark>.
 */

export const SNIPPET_OPEN = '\uE000'
export const SNIPPET_CLOSE = '\uE001'

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function renderSnippetHtml(snippet: string | null | undefined): string {
  if (!snippet) return ''
  return escapeHtml(snippet)
    .replaceAll(SNIPPET_OPEN, '<mark class="hl">')
    .replaceAll(SNIPPET_CLOSE, '</mark>')
}
