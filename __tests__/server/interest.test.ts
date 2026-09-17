import { buildInterestRequest, cleanSummary } from '~/server/utils/interest'

describe('cleanSummary', () => {
  it('strips HTML tags and entities', () => {
    expect(cleanSummary('<p>Hello &amp; <b>world</b></p>')).toBe('Hello world')
  })

  it('clamps to 600 chars', () => {
    const long = 'x'.repeat(700)
    const cleaned = cleanSummary(long)
    expect(cleaned.length).toBe(600)
  })

  it('handles null/undefined/empty', () => {
    expect(cleanSummary(null)).toBe('')
    expect(cleanSummary(undefined)).toBe('')
    expect(cleanSummary('')).toBe('')
  })
})

describe('buildInterestRequest', () => {
  const article = {
    feed: 'Simon Willison',
    title: 'On agentic coding',
    summary: '<p>Some thoughts on <em>agents</em>.</p>',
  }

  it('builds the exact request shape the eval scored', () => {
    const req = buildInterestRequest(article)

    expect(req.model).toBe('jev-latest')
    expect(req.state.article).toEqual({
      feed: 'Simon Willison',
      title: 'On agentic coding',
      summary: 'Some thoughts on agents .',
    })
    expect(typeof req.state.reader_profile).toBe('string')
    expect(req.state.reader_profile).toContain('Norwegian software developer')
    expect(req.state.reader_profile).toContain('Not interested in gadget reviews')

    expect(req.questions.interest.type).toBe('score')
    expect(req.questions.interest.instructions).toBe(
      'How likely is this reader to save or deeply read this article?'
    )
    expect(req.questions.interest.criteria).toHaveLength(3)
    expect(req.questions.interest.criteria[0]).toContain('Skip')
    expect(req.questions.interest.criteria[2]).toContain('Save')
  })

  it('strips and clamps the summary inline', () => {
    const req = buildInterestRequest({
      feed: 'Feed',
      title: 'Title',
      summary: '<p>' + 'y'.repeat(700) + '</p>',
    })
    expect(req.state.article.summary.length).toBe(600)
  })

  it('is JSON-serializable (no undefined/circular fields)', () => {
    expect(() => JSON.stringify(buildInterestRequest(article))).not.toThrow()
  })
})
