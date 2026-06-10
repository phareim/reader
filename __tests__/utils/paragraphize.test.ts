import { looksLikePlainText, paragraphize } from '~/utils/paragraphize'

describe('looksLikePlainText', () => {
  it('is true for prose with no tags', () => {
    expect(looksLikePlainText('Just some plain text.\n\nAnother paragraph.')).toBe(true)
  })

  it('is true for text with bare angle brackets that are not tags', () => {
    expect(looksLikePlainText('5 < 10 and 10 > 5')).toBe(true)
  })

  it('is false for HTML content', () => {
    expect(looksLikePlainText('<p>Hello</p>')).toBe(false)
    expect(looksLikePlainText('Some text with <em>emphasis</em>')).toBe(false)
    expect(looksLikePlainText('an image <img src="x.png"/>')).toBe(false)
  })
})

describe('paragraphize', () => {
  it('returns empty string for empty/whitespace input', () => {
    expect(paragraphize('')).toBe('')
    expect(paragraphize('   \n\n  ')).toBe('')
  })

  it('wraps a single paragraph in <p>', () => {
    expect(paragraphize('Hello world.')).toBe('<p>Hello world.</p>')
  })

  it('splits on blank lines into multiple <p>', () => {
    expect(paragraphize('First.\n\nSecond.\n\n\nThird.')).toBe(
      '<p>First.</p>\n<p>Second.</p>\n<p>Third.</p>'
    )
  })

  it('converts single newlines inside a block to <br>', () => {
    expect(paragraphize('Line one\nLine two')).toBe('<p>Line one<br>Line two</p>')
  })

  it('escapes &, < and >', () => {
    expect(paragraphize('AT&T says 5 < 10 > 2')).toBe(
      '<p>AT&amp;T says 5 &lt; 10 &gt; 2</p>'
    )
  })
})
