import type { H3Event } from 'h3'
import { getD1 } from '~/server/utils/cloudflare'
import { discoverFeeds } from '~/server/utils/feedDiscovery'
import { parseFeed } from '~/server/utils/feedParser'
import { normalizeUrl } from '~/server/utils/urlNormalize'
import { lastRowId, rowsChanged } from '~/server/utils/d1Result'
import {
  parseOpmlOutlines,
  isOpml,
  extractBlogrollLink,
  extractExternalLinks,
  candidateHost,
  isPlatformHost,
  MIN_BLOGROLL_LINKS,
  WELL_KNOWN_OPML_PATHS,
  HTML_BLOGROLL_PATHS,
} from '~/server/utils/blogroll'

/**
 * The Discover crawl — three bounded, individually-resumable stages per
 * invocation (any stage can be cut mid-run and the next run picks up where
 * it left off):
 *
 *   A. crawl sites  — visit subscribed feeds' sites (stalest-first, ≥7-day
 *      re-crawl floor), find a blogroll (rel=blogroll link, well-known OPML
 *      paths, or a human /blogroll|/links page), upsert candidates + edges
 *   B. resolve      — turn site-only candidates into feed URLs via
 *      discoverFeeds() (the expensive stage — up to ~21 fetches per miss)
 *   C. probe        — parseFeed() the resolved URL for title/description/
 *      newest_article_at, promoting to 'candidate'
 *
 * The Worker's per-invocation fetch budget is TIGHT in practice (~50 on the
 * free plan — seed runs proved it, D1 statements appear not to count), so
 * `stages` lets the cron trigger run each stage as its OWN invocation with
 * its own budget; batches are sized so any single stage stays under ~45
 * fetches worst-case. The resolve stage also caps discoverFeeds' path
 * probing (maxProbes 3 ⇒ ≤7 fetches per candidate instead of ≤21).
 */

const RECRAWL_DAYS = 7
const MAX_ATTEMPTS = 3
const FETCH_TIMEOUT_MS = 10_000
/** OPML ingest cap per site — a 300-outline export is a directory dump, and
 *  every ingested row costs 2–3 D1 statements against the subrequest cap. */
const MAX_OPML_OUTLINES = 30
const USER_AGENT = 'Mozilla/5.0 (compatible; RSS Reader/1.0)'

export type DiscoverStage = 'crawl' | 'resolve' | 'probe'

export interface DiscoverCrawlOptions {
  siteBatch: number
  resolveBatch: number
  probeBatch: number
  /** Scope every stage to one user (the session-authed refresh path). */
  userId?: string
  /** Which stages to run this invocation (default: all three). */
  stages?: DiscoverStage[]
}

export interface DiscoverCrawlSummary {
  sitesCrawled: number
  blogrollsFound: number
  candidatesAdded: number
  edgesAdded: number
  resolved: number
  probed: number
  failures: { feedId?: number; candidateId?: number; error: string }[]
}

interface FetchedPage {
  finalUrl: string
  body: string
}

/** Hosts the user already subscribes to (feed URL + site URL) — never
 *  candidates. Shared with the external-candidate ingest endpoint. */
export async function loadSubscribedHosts(db: any, userId: string): Promise<Set<string>> {
  const { results } = await db.prepare(
    'SELECT url, site_url FROM "Feed" WHERE user_id = ?'
  ).bind(userId).all()
  const hosts = new Set<string>()
  for (const row of (results ?? []) as { url: string; site_url: string | null }[]) {
    for (const u of [row.url, row.site_url]) {
      const host = u && candidateHost(u)
      if (host) hosts.add(host)
    }
  }
  return hosts
}

async function fetchText(url: string): Promise<FetchedPage | null> {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    headers: { 'User-Agent': USER_AGENT, Accept: 'text/html,application/xhtml+xml,text/xml,application/xml,*/*' },
  })
  if (!response.ok) return null
  return { finalUrl: response.url || url, body: await response.text() }
}

interface BlogrollItem {
  title: string | null
  xmlUrl: string | null
  htmlUrl: string | null
}

interface FoundBlogroll {
  url: string
  kind: 'opml' | 'html'
  items: BlogrollItem[]
}

/** Locate and parse one site's blogroll. Null when the site has none. */
async function findBlogroll(siteUrl: string): Promise<FoundBlogroll | null> {
  const homepage = await fetchText(siteUrl).catch(() => null)
  const baseUrl = homepage?.finalUrl || siteUrl

  // 1. The explicit convention: <link rel="blogroll"> on the homepage.
  if (homepage) {
    const declared = extractBlogrollLink(homepage.body, homepage.finalUrl)
    if (declared) {
      const page = await fetchText(declared).catch(() => null)
      if (page) {
        if (isOpml(page.body)) {
          const items = parseOpmlOutlines(page.body).slice(0, MAX_OPML_OUTLINES)
          if (items.length) return { url: declared, kind: 'opml', items }
        } else {
          const links = extractExternalLinks(page.body, page.finalUrl)
          if (links.length) {
            return { url: declared, kind: 'html', items: links.map((l) => ({ title: l.title, xmlUrl: null, htmlUrl: l.url })) }
          }
        }
      }
    }
  }

  // 2. Well-known OPML paths.
  for (const path of WELL_KNOWN_OPML_PATHS) {
    const url = new URL(path, baseUrl).toString()
    const page = await fetchText(url).catch(() => null)
    if (page && isOpml(page.body)) {
      const items = parseOpmlOutlines(page.body).slice(0, MAX_OPML_OUTLINES)
      if (items.length) return { url, kind: 'opml', items }
    }
  }

  // 3. Guessed human blogroll pages — body-gated (SPA catch-alls and custom
  // 404s return 200), and a redirect back to the homepage means "no page".
  for (const path of HTML_BLOGROLL_PATHS) {
    const url = new URL(path, baseUrl).toString()
    const page = await fetchText(url).catch(() => null)
    if (!page) continue
    if (homepage && page.finalUrl.replace(/\/$/, '') === homepage.finalUrl.replace(/\/$/, '')) continue
    const links = extractExternalLinks(page.body, page.finalUrl)
    if (links.length >= MIN_BLOGROLL_LINKS) {
      return { url, kind: 'html', items: links.map((l) => ({ title: l.title, xmlUrl: null, htmlUrl: l.url })) }
    }
  }

  return null
}

export async function runDiscoverCrawl(event: H3Event, opts: DiscoverCrawlOptions): Promise<DiscoverCrawlSummary> {
  const db = getD1(event)
  const now = () => new Date().toISOString()
  const stages = opts.stages ?? ['crawl', 'resolve', 'probe']
  const summary: DiscoverCrawlSummary = {
    sitesCrawled: 0,
    blogrollsFound: 0,
    candidatesAdded: 0,
    edgesAdded: 0,
    resolved: 0,
    probed: 0,
    failures: [],
  }

  // Subscribed-host sets cached per user for the whole batch.
  const subscribedHostCache = new Map<string, Set<string>>()
  const subscribedHosts = async (userId: string): Promise<Set<string>> => {
    const cached = subscribedHostCache.get(userId)
    if (cached) return cached
    const hosts = await loadSubscribedHosts(db, userId)
    subscribedHostCache.set(userId, hosts)
    return hosts
  }

  // ---- Stage A: crawl sites -------------------------------------------------
  const cutoff = new Date(Date.now() - RECRAWL_DAYS * 24 * 60 * 60 * 1000).toISOString()
  const { results: feeds } = !stages.includes('crawl') ? { results: [] } : await db.prepare(
    `
    SELECT f.id, f.user_id, f.url, f.site_url
    FROM "Feed" f
    LEFT JOIN "DiscoverCrawl" c ON c.feed_id = f.id
    WHERE f.is_active = 1
      AND f.kind = 'rss'
      AND (c.last_crawled_at IS NULL OR c.last_crawled_at < ?)
      ${opts.userId ? 'AND f.user_id = ?' : ''}
    ORDER BY c.last_crawled_at ASC NULLS FIRST
    LIMIT ?
    `
  ).bind(...(opts.userId ? [cutoff, opts.userId, opts.siteBatch] : [cutoff, opts.siteBatch])).all<{
    id: number
    user_id: string
    url: string
    site_url: string | null
  }>()

  for (const feed of feeds ?? []) {
    let siteUrl: string
    try {
      siteUrl = feed.site_url || new URL(feed.url).origin
    } catch {
      continue
    }

    let blogroll: FoundBlogroll | null = null
    let crawlError: string | null = null
    try {
      blogroll = await findBlogroll(siteUrl)
    } catch (error: any) {
      crawlError = String(error?.message || error)
      summary.failures.push({ feedId: feed.id, error: crawlError })
    }

    summary.sitesCrawled += 1
    if (blogroll) {
      summary.blogrollsFound += 1
      const ownHost = candidateHost(siteUrl)
      const hosts = await subscribedHosts(feed.user_id)

      for (const item of blogroll.items) {
        const host = candidateHost(item.htmlUrl || item.xmlUrl || '')
        if (!host || host === ownHost || hosts.has(host) || isPlatformHost(host)) continue

        const existing = await db.prepare(
          'SELECT id FROM "DiscoverCandidate" WHERE user_id = ? AND site_host = ?'
        ).bind(feed.user_id, host).first<{ id: number }>()

        let candidateId = existing?.id
        if (!candidateId) {
          const feedUrlNorm = item.xmlUrl ? normalizeUrl(item.xmlUrl) : null
          const insert = await db.prepare(
            `
            INSERT INTO "DiscoverCandidate"
              (user_id, status, site_host, site_url, feed_url, feed_url_norm, title, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `
          ).bind(
            feed.user_id,
            item.xmlUrl ? 'unprobed' : 'unresolved',
            host,
            item.htmlUrl,
            item.xmlUrl,
            feedUrlNorm,
            item.title,
            now()
          ).run()
          candidateId = Number(lastRowId(insert))
          if (!candidateId) continue
          summary.candidatesAdded += 1
        }

        // Existing rows of ANY status (incl. dismissed/subscribed/dead) only
        // gain the edge — terminal rows are the fence against resurrection.
        const edge = await db.prepare(
          "INSERT OR IGNORE INTO \"DiscoverEdge\" (candidate_id, feed_id, source) VALUES (?, ?, 'blogroll')"
        ).bind(candidateId, feed.id).run()
        summary.edgesAdded += rowsChanged(edge)
      }
    }

    // Stamp the crawl found-or-not (and on error), so a site without a
    // blogroll — or a broken one — is not revisited before the floor.
    await db.prepare(
      `
      INSERT INTO "DiscoverCrawl" (feed_id, blogroll_url, blogroll_kind, last_crawled_at, last_error)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(feed_id) DO UPDATE SET
        blogroll_url = excluded.blogroll_url,
        blogroll_kind = excluded.blogroll_kind,
        last_crawled_at = excluded.last_crawled_at,
        last_error = excluded.last_error
      `
    ).bind(feed.id, blogroll?.url ?? null, blogroll?.kind ?? null, now(), crawlError).run()
  }

  // ---- Stage B: resolve site-only candidates into feed URLs -----------------
  const { results: unresolved } = !stages.includes('resolve') ? { results: [] } : await db.prepare(
    `
    SELECT id, user_id, site_url, attempts
    FROM "DiscoverCandidate"
    WHERE status = 'unresolved' AND attempts < ?
      ${opts.userId ? 'AND user_id = ?' : ''}
    ORDER BY updated_at ASC
    LIMIT ?
    `
  ).bind(...(opts.userId ? [MAX_ATTEMPTS, opts.userId, opts.resolveBatch] : [MAX_ATTEMPTS, opts.resolveBatch])).all<{
    id: number
    user_id: string
    site_url: string | null
    attempts: number
  }>()

  for (const row of unresolved ?? []) {
    try {
      // maxProbes keeps a miss at ≤7 fetches instead of ≤21 — the Worker's
      // per-invocation fetch budget is the binding constraint here.
      const found = row.site_url ? await discoverFeeds(row.site_url, { maxProbes: 3 }) : []
      if (!found.length) throw new Error('no feed found')
      const feedUrl = found[0].url
      const feedUrlNorm = normalizeUrl(feedUrl)

      // Same feed already tracked under another host (www-variants, mirrors):
      // fold this row's edges into the older candidate and drop it.
      const duplicate = feedUrlNorm
        ? await db.prepare(
            'SELECT id FROM "DiscoverCandidate" WHERE user_id = ? AND feed_url_norm = ? AND id != ?'
          ).bind(row.user_id, feedUrlNorm, row.id).first<{ id: number }>()
        : null
      if (duplicate) {
        // Fold feed edges via the UNIQUE constraint; labeled edges (NULL
        // feed_id, inert under UNIQUE) dedupe on (source) explicitly.
        await db.prepare(
          'INSERT OR IGNORE INTO "DiscoverEdge" (candidate_id, feed_id, source, label) SELECT ?, feed_id, source, label FROM "DiscoverEdge" WHERE candidate_id = ? AND feed_id IS NOT NULL'
        ).bind(duplicate.id, row.id).run()
        await db.prepare(
          `INSERT INTO "DiscoverEdge" (candidate_id, feed_id, source, label)
           SELECT ?, NULL, e.source, e.label FROM "DiscoverEdge" e
           WHERE e.candidate_id = ? AND e.feed_id IS NULL
             AND NOT EXISTS (SELECT 1 FROM "DiscoverEdge" d WHERE d.candidate_id = ? AND d.feed_id IS NULL AND d.source = e.source)`
        ).bind(duplicate.id, row.id, duplicate.id).run()
        await db.prepare('DELETE FROM "DiscoverCandidate" WHERE id = ?').bind(row.id).run()
        continue
      }

      const subscribed = await db.prepare(
        'SELECT id FROM "Feed" WHERE user_id = ? AND url = ?'
      ).bind(row.user_id, feedUrl).first<{ id: number }>()

      await db.prepare(
        `
        UPDATE "DiscoverCandidate"
        SET feed_url = ?, feed_url_norm = ?, status = ?, last_error = NULL, updated_at = ?
        WHERE id = ?
        `
      ).bind(feedUrl, feedUrlNorm, subscribed ? 'subscribed' : 'unprobed', now(), row.id).run()
      summary.resolved += 1
    } catch (error: any) {
      const attempts = row.attempts + 1
      await db.prepare(
        'UPDATE "DiscoverCandidate" SET attempts = ?, last_error = ?, status = ?, updated_at = ? WHERE id = ?'
      ).bind(attempts, String(error?.message || error), attempts >= MAX_ATTEMPTS ? 'dead' : 'unresolved', now(), row.id).run()
      summary.failures.push({ candidateId: row.id, error: String(error?.message || error) })
    }
  }

  // ---- Stage C: probe resolved candidates -----------------------------------
  const { results: unprobed } = !stages.includes('probe') ? { results: [] } : await db.prepare(
    `
    SELECT id, user_id, feed_url, title, attempts
    FROM "DiscoverCandidate"
    WHERE status = 'unprobed' AND attempts < ?
      ${opts.userId ? 'AND user_id = ?' : ''}
    ORDER BY updated_at ASC
    LIMIT ?
    `
  ).bind(...(opts.userId ? [MAX_ATTEMPTS, opts.userId, opts.probeBatch] : [MAX_ATTEMPTS, opts.probeBatch])).all<{
    id: number
    user_id: string
    feed_url: string
    title: string | null
    attempts: number
  }>()

  for (const row of unprobed ?? []) {
    try {
      const parsed = await parseFeed(row.feed_url)
      let newest: Date | null = null
      for (const item of parsed.items) {
        if (item.publishedAt && (!newest || item.publishedAt > newest)) newest = item.publishedAt
      }
      await db.prepare(
        `
        UPDATE "DiscoverCandidate"
        SET title = ?, description = ?, site_url = COALESCE(?, site_url),
            newest_article_at = ?, status = 'candidate', last_error = NULL, updated_at = ?
        WHERE id = ?
        `
      ).bind(
        parsed.title || row.title,
        parsed.description || null,
        parsed.siteUrl || null,
        newest ? newest.toISOString() : null,
        now(),
        row.id
      ).run()
      summary.probed += 1
    } catch (error: any) {
      const attempts = row.attempts + 1
      await db.prepare(
        'UPDATE "DiscoverCandidate" SET attempts = ?, last_error = ?, status = ?, updated_at = ? WHERE id = ?'
      ).bind(attempts, String(error?.message || error), attempts >= MAX_ATTEMPTS ? 'dead' : 'unprobed', now(), row.id).run()
      summary.failures.push({ candidateId: row.id, error: String(error?.message || error) })
    }
  }

  return summary
}
