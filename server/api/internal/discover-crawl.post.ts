import { runDiscoverCrawl } from '~/server/utils/blogrollCrawl'

/**
 * Cron entry for the Discover blogroll crawl (Bearer NUXT_CRON_KEY, called
 * by reader-discover-crawl.timer on Sleeper — NOT by browsers). Batches are
 * sized for the Worker's 1000-subrequest cap: worst case ≈ 30 fetches
 * crawling 5 sites + 6 × ~21 fetches resolving (discoverFeeds probes up to
 * ~10 paths, HEAD+GET each) + 8 probe fetches + ~150 D1 statements ≈ 350.
 * Coverage comes from the timer's cadence (every 6h), not batch size; the
 * resolve stage is also the wall-clock hot spot (up to 30s per page via
 * FETCH_TIMEOUT), which is why the trigger script allows 300s.
 */
export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event)
  const auth = getHeader(event, 'authorization') || ''
  if (!config.cronKey || auth !== `Bearer ${config.cronKey}`) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  return await runDiscoverCrawl(event, {
    siteBatch: 5,
    resolveBatch: 6,
    probeBatch: 8,
  })
})
