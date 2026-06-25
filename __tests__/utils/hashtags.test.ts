import { extractHashtags, renderNoteHtml } from '~/utils/hashtags'

describe('extractHashtags', () => {
  it('returns [] for empty / nullish notes', () => {
    expect(extractHashtags('')).toEqual([])
    expect(extractHashtags(null)).toEqual([])
    expect(extractHashtags(undefined)).toEqual([])
    expect(extractHashtags('no tags here')).toEqual([])
  })

  it('extracts a single tag, lowercased, without the #', () => {
    expect(extractHashtags('a good take on #Programming')).toEqual(['programming'])
  })

  it('dedupes case-insensitively, preserving first-seen order', () => {
    expect(extractHashtags('#design then #Design and #ux')).toEqual(['design', 'ux'])
  })

  it('stops at punctuation and trims a trailing hyphen', () => {
    expect(extractHashtags('written in the #30s, surprisingly')).toEqual(['30s'])
    expect(extractHashtags('a #the-30 thing')).toEqual(['the-30'])
  })

  it('does not tag a # glued to a preceding word char (e.g. urls)', () => {
    expect(extractHashtags('see http://x/a#section')).toEqual([])
  })

  it('handles unicode tag names', () => {
    expect(extractHashtags('om #påske og #ferie')).toEqual(['påske', 'ferie'])
  })
})

describe('renderNoteHtml', () => {
  it('returns empty string for empty note', () => {
    expect(renderNoteHtml('')).toBe('')
    expect(renderNoteHtml(null)).toBe('')
  })

  it('escapes HTML in the note', () => {
    expect(renderNoteHtml('a <b> & "c"')).toBe('a &lt;b&gt; &amp; &quot;c&quot;')
  })

  it('wraps hashtags in an accent span while keeping the # visible', () => {
    expect(renderNoteHtml('great on #programming')).toBe(
      'great on <span class="note-tag">#programming</span>',
    )
  })

  it('preserves the boundary char before the tag', () => {
    expect(renderNoteHtml('x #a')).toBe('x <span class="note-tag">#a</span>')
  })
})
