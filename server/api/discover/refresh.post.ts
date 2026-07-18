import { getAuthenticatedUser } from '~/server/utils/auth'
import { runDiscoverCrawl } from '~/server/utils/blogrollCrawl'

/**
 * On-demand "Look now" from the /discover page: a small crawl scoped to
 * the current user. Self-limiting — the 7-day re-crawl floor means a
 * second click mostly just drains the resolve/probe backlog.
 */
export default defineEventHandler(async (event) => {
  const user = await getAuthenticatedUser(event)
  return await runDiscoverCrawl(event, {
    siteBatch: 3,
    resolveBatch: 4,
    probeBatch: 5,
    userId: String(user.id),
  })
})
