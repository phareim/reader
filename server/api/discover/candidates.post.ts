import { getAuthenticatedUser } from '~/server/utils/auth'
import { getD1 } from '~/server/utils/cloudflare'
import { lastRowId } from '~/server/utils/d1Result'
import { loadSubscribedHosts } from '~/server/utils/blogrollCrawl'
import { candidateHost, isPlatformHost } from '~/server/utils/blogroll'
import { normalizeUrl } from '~/server/utils/urlNormalize'

/**
 * The source-agnostic Discover ingest seam (the /api/ingest of candidates):
 * external collectors — the HN front-page miner, the SFL-saves miner, … —
 * normalize their finds and POST them here; the crawl's resolve/probe
 * stages take it from there. MCP-token auth scopes everything to the
 * calling user. Body:
 *
 *   { source: 'hn-frontpage', label: 'Hacker News front page',
 *     candidates: [{ url, feedUrl?, title? }] }   // ≤50 per call
 *
 * `url` is the site homepage; a collector that already knows the feed URL
 * passes `feedUrl` and skips the expensive resolve stage. Idempotent:
 * existing candidates of ANY status only gain the labeled edge (terminal
 * rows stay the resurrection fence), and re-sends are no-ops.
 */
const MAX_BATCH = 50
const SOURCE_RE = /^[a-z][a-z0-9-]{1,31}$/

export default defineEventHandler(async (event) => {
  const user = await getAuthenticatedUser(event)
  const body = await readBody(event)

  const source = String(body?.source || '')
  if (!SOURCE_RE.test(source) || source === 'blogroll') {
    throw createError({ statusCode: 400, statusMessage: 'Invalid source' })
  }
  const label = body?.label ? String(body.label).slice(0, 80) : source
  const items = Array.isArray(body?.candidates) ? body.candidates.slice(0, MAX_BATCH) : []
  if (!items.length) {
    throw createError({ statusCode: 400, statusMessage: 'No candidates' })
  }

  const db = getD1(event)
  const subscribed = await loadSubscribedHosts(db, String(user.id))
  const now = new Date().toISOString()
  let added = 0
  let edges = 0
  let skipped = 0

  for (const item of items) {
    const siteUrl = typeof item?.url === 'string' ? item.url : null
    const feedUrl = typeof item?.feedUrl === 'string' ? item.feedUrl : null
    const title = typeof item?.title === 'string' ? item.title.slice(0, 200) : null
    const host = candidateHost(siteUrl || feedUrl || '')
    if (!host || isPlatformHost(host) || subscribed.has(host)) {
      skipped += 1
      continue
    }

    const existing = await db.prepare(
      'SELECT id FROM "DiscoverCandidate" WHERE user_id = ? AND site_host = ?'
    ).bind(user.id, host).first<{ id: number }>()

    let candidateId = existing?.id
    if (!candidateId) {
      const insert = await db.prepare(
        `
        INSERT INTO "DiscoverCandidate"
          (user_id, status, site_host, site_url, feed_url, feed_url_norm, title, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `
      ).bind(
        user.id,
        feedUrl ? 'unprobed' : 'unresolved',
        host,
        siteUrl,
        feedUrl,
        feedUrl ? normalizeUrl(feedUrl) : null,
        title,
        now
      ).run()
      candidateId = Number(lastRowId(insert))
      if (!candidateId) {
        skipped += 1
        continue
      }
      added += 1
    }

    // Labeled edges carry NULL feed_id, which the UNIQUE constraint can't
    // dedupe — check explicitly (this endpoint is effectively single-flight).
    const dupe = await db.prepare(
      'SELECT id FROM "DiscoverEdge" WHERE candidate_id = ? AND feed_id IS NULL AND source = ?'
    ).bind(candidateId, source).first<{ id: number }>()
    if (!dupe) {
      await db.prepare(
        'INSERT INTO "DiscoverEdge" (candidate_id, feed_id, source, label) VALUES (?, NULL, ?, ?)'
      ).bind(candidateId, source, label).run()
      edges += 1
    }
  }

  return { added, edges, skipped }
})
