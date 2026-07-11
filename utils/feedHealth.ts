import { formatDistance } from 'date-fns'

/**
 * Quiet per-feed health note for the Sources page. Returns a short muted
 * annotation, or null when the feed is healthy — silence is the default.
 * Only RSS feeds are judged; push-only kinds (found/manual) have no sync
 * to fail and no cadence to expect.
 */

// A feed whose newest article is older than this is "quiet" — likely dead
// or moved. Generous on purpose: monthly writers are not broken.
export const QUIET_DAYS = 45

type FeedHealthInput = {
  kind?: string
  isActive: boolean
  lastError?: string | null
  errorCount: number
  newestArticleAt?: string | null
}

export function feedHealthNote(feed: FeedHealthInput, now: Date = new Date()): string | null {
  if (feed.kind && feed.kind !== 'rss') return null

  if (!feed.isActive && feed.errorCount >= 10) {
    return 'paused after repeated failures — check the URL'
  }
  if (feed.lastError && feed.errorCount > 0) {
    return feed.errorCount === 1 ? 'last sync failed' : `sync failing (${feed.errorCount}×)`
  }
  if (feed.newestArticleAt) {
    const newest = new Date(feed.newestArticleAt)
    const ageDays = (now.getTime() - newest.getTime()) / 86_400_000
    if (Number.isFinite(ageDays) && ageDays > QUIET_DAYS) {
      return `quiet — last article ${formatDistance(newest, now, { addSuffix: true })}`
    }
  }
  return null
}
