import { getAuthenticatedUser } from '~/server/utils/auth'
import { runDiscoverCrawl } from '~/server/utils/blogrollCrawl'

/**
 * On-demand "Look now" from the /discover page: a small crawl scoped to
 * the current user. Self-limiting — the 7-day re-crawl floor means a
 * second click mostly just drains the resolve/probe backlog. Batches are
 * sized for ONE Worker invocation's ~50-fetch budget: 2 sites (≤12) +
 * 2 resolves (≤14, discoverFeeds probing capped) + 3 probes (≤6) ≈ 32.
 */
export default defineEventHandler(async (event) => {
  const user = await getAuthenticatedUser(event)
  return await runDiscoverCrawl(event, {
    siteBatch: 2,
    resolveBatch: 2,
    probeBatch: 3,
    userId: String(user.id),
  })
})
