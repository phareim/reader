import { buildFtsQuery, SNIPPET_OPEN, SNIPPET_CLOSE } from '~/server/utils/searchIndex'
import {
  renderSnippetHtml,
  SNIPPET_OPEN as CLIENT_OPEN,
  SNIPPET_CLOSE as CLIENT_CLOSE,
} from '~/utils/searchRender'

describe('buildFtsQuery', () => {
  it('quotes every token and prefixes the last', () => {
    expect(buildFtsQuery('calm software')).toBe('"calm" "software"*')
    expect(buildFtsQuery('rust')).toBe('"rust"*')
  })

  it('collapses whitespace and trims', () => {
    expect(buildFtsQuery('  calm   software  ')).toBe('"calm" "software"*')
  })

  it('neutralizes FTS syntax by quoting', () => {
    expect(buildFtsQuery('NOT OR AND')).toBe('"NOT" "OR" "AND"*')
    expect(buildFtsQuery('a* (b:c)')).toBe('"a*" "(b:c)"*')
  })

  it('strips embedded double quotes so tokens cannot escape', () => {
    expect(buildFtsQuery('he said "hello" x')).toBe('"he" "said" "hello" "x"*')
  })

  it('returns null when nothing searchable remains', () => {
    expect(buildFtsQuery('')).toBeNull()
    expect(buildFtsQuery('   ')).toBeNull()
    expect(buildFtsQuery('""')).toBeNull()
  })

  it('caps at 8 tokens', () => {
    const q = buildFtsQuery('a b c d e f g h i j')!
    expect(q.split(' ')).toHaveLength(8)
  })
})

describe('renderSnippetHtml', () => {
  it('shares the sentinel characters with the server', () => {
    expect(CLIENT_OPEN).toBe(SNIPPET_OPEN)
    expect(CLIENT_CLOSE).toBe(SNIPPET_CLOSE)
  })

  it('turns sentinels into mark tags', () => {
    expect(renderSnippetHtml(`a ${SNIPPET_OPEN}hit${SNIPPET_CLOSE} b`)).toBe(
      'a <mark class="hl">hit</mark> b'
    )
  })

  it('escapes HTML before marking, so body markup cannot inject', () => {
    const snip = `<script>alert(1)</script> ${SNIPPET_OPEN}x${SNIPPET_CLOSE}`
    expect(renderSnippetHtml(snip)).toBe(
      '&lt;script&gt;alert(1)&lt;/script&gt; <mark class="hl">x</mark>'
    )
  })

  it('handles empty input', () => {
    expect(renderSnippetHtml('')).toBe('')
    expect(renderSnippetHtml(null)).toBe('')
    expect(renderSnippetHtml(undefined)).toBe('')
  })

  it('marks multiple hits', () => {
    const snip = `${SNIPPET_OPEN}a${SNIPPET_CLOSE} and ${SNIPPET_OPEN}b${SNIPPET_CLOSE}`
    expect(renderSnippetHtml(snip)).toBe(
      '<mark class="hl">a</mark> and <mark class="hl">b</mark>'
    )
  })
})
