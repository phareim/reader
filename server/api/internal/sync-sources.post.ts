import { getD1 } from '~/server/utils/cloudflare'
import { refreshXToken } from '~/server/utils/xOauth'
import { refreshRedditToken, REDDIT_UA } from '~/server/utils/redditOauth'
import { renderTweet, buildIncludeMaps, type FoundItem } from '~/server/utils/xRender'
import { renderRedditChild } from '~/server/utils/redditRender'
import { parseFavoriteIds, hasMoreFavorites, renderHnItem } from '~/server/utils/hn'
import { renderGithubStar, GITHUB_UA } from '~/server/utils/githubStars'
import { resolveFoundFeed } from '~/server/utils/foundFeed'
import { insertArticleWithContent } from '~/server/utils/article-store'
import { normalizeUrl } from '~/server/utils/urlNormalize'
import {
  listAllLinkedSources,
  parseCredentials,
  updateLinkedSourceCredentials,
  recordSyncResult,
  type LinkedSourceRow,
  type OauthCredentials,
} from '~/server/utils/linkedSources'

/**
 * POST /api/internal/sync-sources — Worker-side Found-feed sync for every
 * LinkedSource row of every user (Bearer NUXT_CRON_KEY, systemd timer
 * reader-sources-sync.timer). Replaces the X-only sync-x-bookmarks route.
 *
 * Shared shape per source: refresh OAuth credentials if near expiry (X and
 * Reddit ROTATE refresh tokens — the rotation is persisted to D1
 * immediately, and this endpoint is the credentials' only refresher), page
 * items newest-first, stop once a page isn't entirely new (a D1 guid check
 * against the user's Found feed — no local seen-set), render via the pure
 * per-source renderer, insert. A failed source records last_error on its
 * row (surfaced on /sources) and never blocks the others.
 */
const REFRESH_MARGIN_S = 300

const X_PAGE = 25 // X bills per post returned (~$0.005) — keep pages small
const X_MAX_PAGES = 5
const REDDIT_PAGE = 50 // free API; Reddit max is 100
const REDDIT_MAX_PAGES = 5
const HN_MAX_PAGES = 2 // 30 favorites/page; favorites accrue slowly
const GITHUB_PAGE = 30 // stars accrue slowly too; unauthenticated API is 60 req/h per IP
const GITHUB_MAX_PAGES = 2

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event)
  const auth = getHeader(event, 'authorization') || ''
  if (!config.cronKey || auth !== `Bearer ${config.cronKey}`) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const rows = await listAllLinkedSources(event)
  const summary: Array<{ source: string; handle: string | null; ingested: number; error?: string }> = []

  for (const row of rows) {
    const result = { source: row.source, handle: row.handle, ingested: 0 } as (typeof summary)[0]
    summary.push(result)
    try {
      if (row.source === 'x') result.ingested = await syncX(event, row)
      else if (row.source === 'reddit') result.ingested = await syncReddit(event, row)
      else if (row.source === 'hackernews') result.ingested = await syncHackerNews(event, row)
      else if (row.source === 'github') result.ingested = await syncGithub(event, row)
      else throw new Error(`no sync handler for source '${row.source}'`)
      await recordSyncResult(event, row.id)
    } catch (error: any) {
      result.error = String(error?.message || error).slice(0, 500)
      console.error(`sync failed for ${row.source}/${row.handle ?? row.user_id}:`, result.error)
      await recordSyncResult(event, row.id, result.error)
    }
  }

  return {
    sources: summary.length,
    ingested: summary.reduce((sum, r) => sum + r.ingested, 0),
    results: summary,
  }
})

/** Refresh an OAuth token set if near expiry, persisting the rotation. */
async function ensureFreshCredentials(
  event: any,
  row: LinkedSourceRow,
  refresh: (event: any, refreshToken: string) => Promise<any>
): Promise<OauthCredentials> {
  const creds = parseCredentials(row)
  if (!creds?.access_token) throw new Error('missing credentials — re-link needed')

  const age = Math.floor(Date.now() / 1000) - (creds.obtained_at || 0)
  if (age < (creds.expires_in || 3600) - REFRESH_MARGIN_S) return creds

  const token = await refresh(event, creds.refresh_token)
  if (!token.ok) {
    // A dead refresh token needs a re-link from /sources; last_error
    // surfaces that in the UI.
    throw new Error(`token refresh failed — re-link may be needed (${token.error})`)
  }
  const next: OauthCredentials = {
    access_token: token.access_token,
    refresh_token: token.refresh_token,
    obtained_at: token.obtained_at,
    expires_in: token.expires_in,
  }
  await updateLinkedSourceCredentials(event, row.id, next)
  return next
}

/**
 * Which of these guids already exist in the feed? Shared stop-condition
 * helper: a page that isn't entirely new means everything older is known.
 */
async function knownGuids(event: any, feedId: number, guids: string[]): Promise<Set<string>> {
  if (!guids.length) return new Set()
  const placeholders = guids.map(() => '?').join(',')
  const { results } = await getD1(event).prepare(
    `SELECT guid FROM "Article" WHERE feed_id = ? AND guid IN (${placeholders})`
  ).bind(feedId, ...guids).all()
  return new Set((results ?? []).map((r: any) => r.guid))
}

async function insertItems(event: any, feedId: number, items: FoundItem[]): Promise<number> {
  // Cross-source URL dedup: an item whose page already sits in Found under
  // another source's guid lands as a READ tombstone (no body) instead of a
  // second visible card. The guid still gets recorded, so the "stop once a
  // page isn't all-new" paging above stays honest — a plain skip would keep
  // the item guid-fresh forever and re-page past it on every sync.
  const norms = items
    .map((item) => normalizeUrl(item.url))
    .filter((n): n is string => !!n)
  let dupNorms = new Set<string>()
  if (norms.length) {
    const placeholders = norms.map(() => '?').join(',')
    const { results } = await getD1(event).prepare(
      `SELECT url_norm FROM "Article" WHERE feed_id = ? AND url_norm IN (${placeholders})`
    ).bind(feedId, ...norms).all()
    dupNorms = new Set((results ?? []).map((r: any) => r.url_norm))
  }

  let ingested = 0
  for (const item of items) {
    const norm = normalizeUrl(item.url)
    const isDup = !!norm && dupNorms.has(norm)
    if (norm) dupNorms.add(norm) // also dedup within this batch
    const insert = await insertArticleWithContent(event, feedId, {
      guid: `${item.source}:${item.externalId}`,
      title: item.title,
      url: item.url,
      author: item.author,
      content: isDup ? undefined : item.content,
      summary: item.summary,
      imageUrl: item.imageUrl,
      publishedAt: item.publishedAt || null,
      source: item.source,
      markRead: isDup,
    })
    if (insert.inserted && !isDup) ingested++
  }
  return ingested
}

// --- X bookmarks ---

const X_PARAMS = {
  max_results: String(X_PAGE),
  expansions:
    'author_id,attachments.media_keys,referenced_tweets.id,referenced_tweets.id.author_id,article.cover_media,article.media_entities',
  'tweet.fields':
    'id,text,note_tweet,article,created_at,lang,entities,referenced_tweets,attachments,conversation_id',
  'user.fields': 'id,name,username',
  'media.fields': 'media_key,type,url,preview_image_url,alt_text',
}

async function syncX(event: any, row: LinkedSourceRow): Promise<number> {
  const creds = await ensureFreshCredentials(event, row, refreshXToken)
  const feedId = await resolveFoundFeed(event, row.user_id)

  let ingested = 0
  let next: string | null = null
  let page = 0

  do {
    const params = new URLSearchParams(X_PARAMS)
    if (next) params.set('pagination_token', next)

    const res = await fetch(`https://api.x.com/2/users/${row.external_id}/bookmarks?${params}`, {
      headers: { Authorization: `Bearer ${creds.access_token}` },
      signal: AbortSignal.timeout(20_000),
    })
    const j: any = await res.json().catch(() => ({}))
    if (!res.ok) {
      // No sleep-and-retry on 429 in a Worker — the timer retries the whole
      // run later, and pages already ingested are deduped by guid.
      throw new Error(`X bookmarks ${res.status}: ${JSON.stringify(j).slice(0, 300)}`)
    }

    const data: any[] = j.data || []
    if (!data.length) break
    const maps = buildIncludeMaps(j.includes)

    const known = await knownGuids(event, feedId, data.map((t) => `x-bookmark:${t.id}`))
    const fresh = data.filter((t) => !known.has(`x-bookmark:${t.id}`))
    ingested += await insertItems(event, feedId, fresh.map((t) => renderTweet(t, maps)))

    page++
    next = j.meta?.next_token || null
    if (fresh.length < data.length) break // caught up
  } while (next && page < X_MAX_PAGES)

  return ingested
}

// --- Reddit saved items ---

async function syncReddit(event: any, row: LinkedSourceRow): Promise<number> {
  const creds = await ensureFreshCredentials(event, row, refreshRedditToken)
  const feedId = await resolveFoundFeed(event, row.user_id)

  let ingested = 0
  let after: string | null = null
  let page = 0

  do {
    const qs = new URLSearchParams({ limit: String(REDDIT_PAGE), raw_json: '1' })
    if (after) qs.set('after', after)

    const res = await fetch(`https://oauth.reddit.com/user/${row.external_id}/saved?${qs}`, {
      headers: { Authorization: `Bearer ${creds.access_token}`, 'User-Agent': REDDIT_UA },
      signal: AbortSignal.timeout(20_000),
    })
    const j: any = await res.json().catch(() => ({}))
    if (!res.ok) {
      throw new Error(`Reddit saved ${res.status}: ${JSON.stringify(j).slice(0, 300)}`)
    }

    const children: any[] = j.data?.children || []
    if (!children.length) break

    const named = children.filter((c) => c?.data?.name)
    const known = await knownGuids(event, feedId, named.map((c) => `reddit:${c.data.name}`))
    const fresh = named.filter((c) => !known.has(`reddit:${c.data.name}`))
    const items = fresh.map(renderRedditChild).filter((i): i is FoundItem => !!i && !!i.url)
    ingested += await insertItems(event, feedId, items)

    page++
    after = j.data?.after || null
    if (fresh.length < named.length) break // caught up
  } while (after && page < REDDIT_MAX_PAGES)

  return ingested
}

// --- Hacker News favorites (public — no credentials) ---

async function syncHackerNews(event: any, row: LinkedSourceRow): Promise<number> {
  const feedId = await resolveFoundFeed(event, row.user_id)

  let ingested = 0
  for (let page = 1; page <= HN_MAX_PAGES; page++) {
    const res = await fetch(
      `https://news.ycombinator.com/favorites?id=${encodeURIComponent(row.external_id || '')}&p=${page}`,
      { headers: { 'User-Agent': 'reader-found-sync/1.0 (reader.phareim.no)' }, signal: AbortSignal.timeout(15_000) }
    )
    if (!res.ok) throw new Error(`HN favorites page ${res.status}`)
    const html = await res.text()

    const ids = parseFavoriteIds(html)
    if (!ids.length) break

    const known = await knownGuids(event, feedId, ids.map((id) => `hn-favorite:${id}`))
    const freshIds = ids.filter((id) => !known.has(`hn-favorite:${id}`))

    for (const id of freshIds) {
      const itemRes = await fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`, {
        signal: AbortSignal.timeout(10_000),
      })
      const item = itemRes.ok ? await itemRes.json().catch(() => null) : null
      const rendered = renderHnItem(item)
      if (rendered) ingested += await insertItems(event, feedId, [rendered])
    }

    if (freshIds.length < ids.length || !hasMoreFavorites(html)) break // caught up
  }

  return ingested
}

// --- GitHub stars (public — no credentials) ---

async function syncGithub(event: any, row: LinkedSourceRow): Promise<number> {
  const feedId = await resolveFoundFeed(event, row.user_id)

  let ingested = 0
  for (let page = 1; page <= GITHUB_MAX_PAGES; page++) {
    // star+json puts starred_at on each entry; default order is
    // newest-starred first. Unauthenticated (60 req/h per IP) — a 403/429
    // burst just records last_error and the next timer run retries.
    const res = await fetch(
      `https://api.github.com/users/${encodeURIComponent(row.external_id || '')}/starred?per_page=${GITHUB_PAGE}&page=${page}`,
      {
        headers: { 'User-Agent': GITHUB_UA, Accept: 'application/vnd.github.star+json' },
        signal: AbortSignal.timeout(15_000),
      }
    )
    const entries: any = res.ok ? await res.json().catch(() => null) : null
    if (!res.ok || !Array.isArray(entries)) {
      throw new Error(`GitHub starred ${res.status}`)
    }
    if (!entries.length) break

    const withRepo = entries.filter((e) => (e?.repo ?? e)?.id)
    const known = await knownGuids(event, feedId, withRepo.map((e) => `github-star:${(e.repo ?? e).id}`))
    const fresh = withRepo.filter((e) => !known.has(`github-star:${(e.repo ?? e).id}`))
    const items = fresh.map(renderGithubStar).filter((i): i is FoundItem => !!i)
    ingested += await insertItems(event, feedId, items)

    if (fresh.length < withRepo.length || entries.length < GITHUB_PAGE) break // caught up
  }

  return ingested
}
