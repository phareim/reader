import { getD1 } from '~/server/utils/cloudflare'
import { refreshXToken } from '~/server/utils/xOauth'
import { renderTweet, buildIncludeMaps } from '~/server/utils/xRender'
import { resolveFoundFeed } from '~/server/utils/foundFeed'
import { insertArticleWithContent } from '~/server/utils/article-store'

/**
 * POST /api/internal/sync-x-bookmarks — Worker-side X bookmark sync for
 * every linked account (Bearer NUXT_CRON_KEY, called by a systemd timer on
 * Sleeper — see scripts/systemd/reader-x-bookmarks.timer). Replaces the
 * retired scripts/x-bookmark-sync.mjs collector.
 *
 * Per account: refresh the token if near expiry (X ROTATES refresh tokens —
 * the rotation is persisted to D1 immediately, and this endpoint is the
 * token's only refresher), then page newest-first through bookmarks,
 * stopping once a page isn't entirely new (D1 guid check replaces the old
 * collector's seen-set) or MAX_PAGES is hit. New items render via
 * server/utils/xRender.ts and insert into the user's Found feed.
 *
 * X charges per post returned (~$0.005), so FIRST_PAGE stays small and the
 * catch-up bound tight: 5 × 25 = 125 posts worst case per account per run.
 */
const FIRST_PAGE = 25
const MAX_PAGES = 5
const REFRESH_MARGIN_S = 300

const BOOKMARK_PARAMS = {
  max_results: String(FIRST_PAGE),
  expansions:
    'author_id,attachments.media_keys,referenced_tweets.id,referenced_tweets.id.author_id,article.cover_media,article.media_entities',
  'tweet.fields':
    'id,text,note_tweet,article,created_at,lang,entities,referenced_tweets,attachments,conversation_id',
  'user.fields': 'id,name,username',
  'media.fields': 'media_key,type,url,preview_image_url,alt_text',
}

type XAccountRow = {
  user_id: string
  x_user_id: string
  handle: string | null
  access_token: string
  refresh_token: string
  obtained_at: number
  expires_in: number
}

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event)
  const auth = getHeader(event, 'authorization') || ''
  if (!config.cronKey || auth !== `Bearer ${config.cronKey}`) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const db = getD1(event)
  const { results: accounts } = await db.prepare(`SELECT * FROM "XAccount"`).all<XAccountRow>()

  const summary: Array<{ user: string; handle: string | null; ingested: number; error?: string }> = []

  for (const account of accounts ?? []) {
    const result = { user: account.user_id, handle: account.handle, ingested: 0 } as (typeof summary)[0]
    summary.push(result)
    try {
      const accessToken = await ensureFreshToken(event, db, account)
      result.ingested = await syncAccount(event, db, account, accessToken)
      await db.prepare(
        `UPDATE "XAccount" SET last_sync_at = ?, last_error = NULL WHERE user_id = ?`
      ).bind(new Date().toISOString(), account.user_id).run()
    } catch (error: any) {
      result.error = String(error?.message || error).slice(0, 500)
      console.error(`X sync failed for ${account.handle ?? account.user_id}:`, result.error)
      await db.prepare(
        `UPDATE "XAccount" SET last_error = ? WHERE user_id = ?`
      ).bind(result.error, account.user_id).run()
    }
  }

  return {
    accounts: summary.length,
    ingested: summary.reduce((sum, r) => sum + r.ingested, 0),
    results: summary,
  }
})

async function ensureFreshToken(event: any, db: any, account: XAccountRow): Promise<string> {
  const age = Math.floor(Date.now() / 1000) - (account.obtained_at || 0)
  if (age < (account.expires_in || 7200) - REFRESH_MARGIN_S) return account.access_token

  const token = await refreshXToken(event, account.refresh_token)
  if (!token.ok) {
    // An invalid_grant here means the refresh token is dead — the account
    // needs a re-link from /sources; last_error surfaces that in the UI.
    throw new Error(`token refresh failed — re-link may be needed (${token.error})`)
  }
  await db.prepare(
    `UPDATE "XAccount" SET access_token = ?, refresh_token = ?, obtained_at = ?, expires_in = ? WHERE user_id = ?`
  ).bind(token.access_token, token.refresh_token, token.obtained_at, token.expires_in, account.user_id).run()
  return token.access_token
}

async function syncAccount(
  event: any,
  db: any,
  account: XAccountRow,
  accessToken: string
): Promise<number> {
  const feedId = await resolveFoundFeed(event, account.user_id)

  let ingested = 0
  let next: string | null = null
  let page = 0

  do {
    const params = new URLSearchParams(BOOKMARK_PARAMS)
    if (next) params.set('pagination_token', next)

    const res = await fetch(
      `https://api.x.com/2/users/${account.x_user_id}/bookmarks?${params}`,
      { headers: { Authorization: `Bearer ${accessToken}` }, signal: AbortSignal.timeout(20_000) }
    )
    const j: any = await res.json().catch(() => ({}))
    if (!res.ok) {
      // No sleep-and-retry on 429 in a Worker — the timer retries the whole
      // run later, and pages already ingested are deduped by guid.
      throw new Error(`X bookmarks ${res.status}: ${JSON.stringify(j).slice(0, 300)}`)
    }

    const data: any[] = j.data || []
    if (!data.length) break
    const maps = buildIncludeMaps(j.includes)

    // Which of this page's ids are already in the Found feed? (Replaces the
    // old collector's local seen-set — INSERT OR IGNORE would dedupe anyway,
    // but this also decides when we've caught up and can stop paging.)
    const guids = data.map((t) => `x-bookmark:${t.id}`)
    const placeholders = guids.map(() => '?').join(',')
    const { results: existing } = await db.prepare(
      `SELECT guid FROM "Article" WHERE feed_id = ? AND guid IN (${placeholders})`
    ).bind(feedId, ...guids).all()
    const known = new Set((existing ?? []).map((r: any) => r.guid))

    const fresh = data.filter((t) => !known.has(`x-bookmark:${t.id}`))
    for (const t of fresh) {
      const item = renderTweet(t, maps)
      const insert = await insertArticleWithContent(event, feedId, {
        guid: `${item.source}:${item.externalId}`,
        title: item.title,
        url: item.url,
        author: item.author,
        content: item.content,
        summary: item.summary,
        imageUrl: item.imageUrl,
        publishedAt: item.publishedAt || null,
        source: item.source,
      })
      if (insert.inserted) ingested++
    }

    page++
    next = j.meta?.next_token || null
    // Stop once we've caught up: a page that wasn't entirely new means older
    // bookmarks below are already ingested. Keep paging only on a full-new page.
    if (fresh.length < data.length) break
  } while (next && page < MAX_PAGES)

  return ingested
}
