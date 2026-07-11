import { feedHealthNote, QUIET_DAYS } from '~/utils/feedHealth'

const NOW = new Date('2026-07-11T12:00:00Z')

const healthy = {
  kind: 'rss',
  isActive: true,
  lastError: null,
  errorCount: 0,
  newestArticleAt: '2026-07-10T00:00:00Z',
}

const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000).toISOString()

describe('feedHealthNote', () => {
  it('is silent for a healthy feed', () => {
    expect(feedHealthNote(healthy, NOW)).toBeNull()
  })

  it('is silent for push-only kinds even when stale', () => {
    expect(
      feedHealthNote({ ...healthy, kind: 'found', newestArticleAt: daysAgo(200) }, NOW)
    ).toBeNull()
    expect(
      feedHealthNote({ ...healthy, kind: 'manual', lastError: 'x', errorCount: 3 }, NOW)
    ).toBeNull()
  })

  it('treats missing kind as rss (pre-kind rows)', () => {
    expect(
      feedHealthNote({ ...healthy, kind: undefined, lastError: 'boom', errorCount: 2 }, NOW)
    ).toBe('sync failing (2×)')
  })

  it('reports a paused feed (auto-deactivated after 10 failures)', () => {
    expect(
      feedHealthNote({ ...healthy, isActive: false, lastError: 'x', errorCount: 12 }, NOW)
    ).toBe('paused after repeated failures — check the URL')
  })

  it('reports failing syncs, singular and counted', () => {
    expect(feedHealthNote({ ...healthy, lastError: 'timeout', errorCount: 1 }, NOW)).toBe(
      'last sync failed'
    )
    expect(feedHealthNote({ ...healthy, lastError: 'timeout', errorCount: 4 }, NOW)).toBe(
      'sync failing (4×)'
    )
  })

  it('reports a quiet feed past the threshold, silent within it', () => {
    expect(feedHealthNote({ ...healthy, newestArticleAt: daysAgo(QUIET_DAYS - 1) }, NOW)).toBeNull()
    const note = feedHealthNote({ ...healthy, newestArticleAt: daysAgo(90) }, NOW)
    expect(note).toMatch(/^quiet — last article/)
    expect(note).toMatch(/3 months ago/)
  })

  it('is silent when the feed has no articles yet', () => {
    expect(feedHealthNote({ ...healthy, newestArticleAt: null }, NOW)).toBeNull()
  })

  it('failing beats quiet when both apply', () => {
    expect(
      feedHealthNote(
        { ...healthy, lastError: 'x', errorCount: 3, newestArticleAt: daysAgo(90) },
        NOW
      )
    ).toBe('sync failing (3×)')
  })
})
