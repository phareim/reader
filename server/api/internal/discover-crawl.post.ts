import { runDiscoverCrawl, type DiscoverStage } from '~/server/utils/blogrollCrawl'

/**
 * Cron entry for the Discover blogroll crawl (Bearer NUXT_CRON_KEY, called
 * by reader-discover-crawl.timer on Sleeper — NOT by browsers).
 *
 * The Worker's per-invocation fetch budget is ~50 in practice, so the
 * trigger script calls this once per stage (`{ stage: 'crawl'|'resolve'|
 * 'probe' }`) — each call is its own invocation with its own budget:
 * crawl 5 sites ≈ ≤30 fetches; resolve 5 candidates × ≤7 (discoverFeeds
 * capped at 3 path probes) ≈ ≤35; probe 8 feeds ≈ ≤16. Without a stage the
 * whole pipeline runs with small batches (kept for hand-testing).
 */
const STAGE_BATCHES: Record<DiscoverStage, { siteBatch: number; resolveBatch: number; probeBatch: number }> = {
  crawl: { siteBatch: 5, resolveBatch: 0, probeBatch: 0 },
  resolve: { siteBatch: 0, resolveBatch: 5, probeBatch: 0 },
  probe: { siteBatch: 0, resolveBatch: 0, probeBatch: 8 },
}

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event)
  const auth = getHeader(event, 'authorization') || ''
  if (!config.cronKey || auth !== `Bearer ${config.cronKey}`) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const body = await readBody(event).catch(() => null)
  const stage = body?.stage as DiscoverStage | undefined
  if (stage && !(stage in STAGE_BATCHES)) {
    throw createError({ statusCode: 400, statusMessage: 'Unknown stage' })
  }

  if (stage) {
    return await runDiscoverCrawl(event, { ...STAGE_BATCHES[stage], stages: [stage] })
  }
  return await runDiscoverCrawl(event, { siteBatch: 2, resolveBatch: 2, probeBatch: 4 })
})
