# The Found feed — social bookmarks pipeline

A push-only feed that collects bookmarks/saves from social sources (X first,
more later), surfaced as a dedicated **Found** tab while behaving like any other
feed. Shipped 2026-06-27.

## Why

The Reader's feeds are RSS-pull. Bookmarks on X (and later Mastodon, Reddit, …)
are a different shape: there's no RSS, the content needs source-specific
extraction, and auth is per-user OAuth. Rather than teach the Reader about each
network, we keep it **source-agnostic** and push normalized items into it from
Sleeper-side collectors.

```
X bookmarks ──┐
Bluesky ──────┤
Mastodon ─────┼─→ [Sleeper collector(s)] ──POST /api/ingest──→ Reader (D1+R2) ──→ "Found" feed + tab
Instapaper ───┘   normalize to one shape    (MCP-authed)         ↑ behaves like any feed
```

Adding a new source = a new collector that POSTs the same shape. **Zero Reader
changes.** Four collectors ship today (`source=x-bookmark`, `bluesky`,
`mastodon`, `instapaper`); each is a standalone `scripts/*-sync.mjs` + a systemd
user timer.

## Data model (migration `006-found.sql`)

- `Feed.kind TEXT NOT NULL DEFAULT 'rss'` — `'found'` marks the single push-only
  social-bookmark feed per user (`is_active=0`, so `/api/sync` never RSS-fetches
  it — same trick as the `'manual'` Manual Additions feed). `'rss'` for everything
  else.
- `Article.source TEXT` — per-item origin inside Found (`'x-bookmark'`, future
  `'mastodon'`/`'reddit'`/…). NULL for RSS articles.
- Index `idx_feed_user_kind (user_id, kind)`.

Applied to prod with:
`wrangler d1 execute reader-service --remote --file=database/migrations/006-found.sql`

## API — `POST /api/ingest`

The one generic seam. MCP-authed (`X-MCP-Token`).

```jsonc
// request body
{
  "source": "x-bookmark",      // required — origin tag
  "externalId": "1934…",       // required — id within the source
  "url": "https://x.com/…",     // required
  "title": "…",                 // required
  "author": "@handle",          // optional
  "content": "<p>…</p>",        // optional — HTML, stored in R2, sanitized at display
  "summary": "…",               // optional
  "imageUrl": "https://…",       // optional — card hero
  "publishedAt": "2026-…Z"      // optional
}
// response
{ "success": true, "ingested": true, "existing": false,
  "article": { "id": 12852, "url": "…", "feedId": 53 } }
```

- Resolves (or lazily creates) the user's `kind='found'` feed.
- `guid = "${source}:${externalId}"` → idempotent through `UNIQUE(feed_id, guid)`
  + `INSERT OR IGNORE`. A re-POST returns `ingested:false, existing:true`.
- Items land **unread**; the endpoint does **not** save or mark read, so they flow
  into the deck like any article.

## The Found tab (web app)

- `BottomBar.vue` — four rooms now: **Deck · Found · Shelf · Sources**. `/found`
  is active only on `route.name === 'found'`.
- `pages/found.vue` — resolves the `kind='found'` feed from `useFeeds()` and mounts
  the existing `<DeckScreen :feed-id>` scoped to it. So Found is a normal swipeable
  deck: the five verbs work, and **swipe-up elevates a found tweet straight into
  SFL → thoughts/wiki**. Shows a "Nothing found yet" empty state until the first
  item arrives.
- Because Found is a real feed, it also appears in the main Deck (`/` pulls all
  feeds) and under Sources automatically.
- `GET /api/feeds` now returns `kind` per feed; the `Feed` type carries
  `kind?: 'rss' | 'found' | 'manual'`.

## X bookmark collector (Sleeper-side)

`scripts/x-bookmark-sync.mjs` — Sleeper-only, like `feed-candidates.mjs`.

Each run:
1. Refreshes the X OAuth2 **user** token if near expiry (rotates + persists the
   refresh token).
2. Pages newest-first through `@phareim`'s bookmarks, stopping once it reaches
   already-ingested ids (bounded by `FIRST_PAGE=25` / `--max-pages`, default 5).
3. Renders each new tweet to HTML **with quoted + reply/thread context** — all
   carried in the one bookmarks call via `expansions=referenced_tweets.id,…`, so the
   extra depth costs **no extra X requests**.
4. POSTs each to `/api/ingest` as `source=x-bookmark`.

Flags: `--dry-run`, `--verbose`, `--max-pages N`.

### Auth / config (files, not env — cron has no shell)

| Path | Holds |
|---|---|
| `~/.config/x-bookmarks/env` | `X_CLIENT_ID`, `X_CLIENT_SECRET`, `X_REDIRECT_URI` |
| `~/.config/x-bookmarks/token.json` | OAuth2 user token (access + rotating refresh) |
| `~/.config/x-bookmarks/state.json` | `seen_ids[]` high-water set, `last_run`, `total_ingested` |
| `~/.config/reader/env` | `READER_API_URL`, `READER_MCP_TOKEN` |

The OAuth2 user token was minted once via an Authorization-Code-with-PKCE flow
(scopes `tweet.read users.read bookmark.read offline.access`) — app-only Bearer
**cannot** read bookmarks. `state.json` was seeded with the 299 bookmarks that
predate the pipeline (those went to SFL, not Found) so Found only collects new ones.

### Schedule

systemd **user** timer, vendored under `scripts/systemd/`:
- `x-bookmark-sync.timer` — `OnCalendar=*-*-* 07,19:30:00`, `Persistent=true`,
  `RandomizedDelaySec=600` (twice daily; catches up a run missed while the host
  was off).
- `x-bookmark-sync.service` — `Type=oneshot`, runs the script with `/usr/bin/node`.

Install: copy both into `~/.config/systemd/user/`, then
`systemctl --user daemon-reload && systemctl --user enable --now x-bookmark-sync.timer`.

Ops: `journalctl --user -u x-bookmark-sync` to tail · `systemctl --user start
x-bookmark-sync.service` to run now · `systemctl --user list-timers` for next run.

### Cost

X v2 is pay-per-usage at **$0.005 per post returned**. Twice-daily polling of a
25-post first page bounds idle cost to ≈ $0.25/day worst case; you only ever pay
for posts actually returned. `since_id` is deliberately **not** used: bookmarking
an *old* tweet would surface a low id at the top of the newest-first list, which an
id high-water mark would wrongly skip — hence the explicit `seen_ids` set instead.

## Bluesky bookmark collector (Sleeper-side)

`scripts/bluesky-bookmark-sync.mjs` — the lowest-friction collector. Bluesky app
passwords are free, there's no OAuth dance and no per-call billing.

Each run:
1. Opens an AT Protocol session from the app password (`createSession`), reusing
   + refreshing the cached JWT (`refreshSession`) across runs.
2. Pages newest-first through the authed user's native bookmarks
   (`app.bsky.bookmark.getBookmarks`, proxied through the PDS), stopping once it
   reaches already-ingested ids (bounded by `FIRST_PAGE=50` / `--max-pages`).
3. Renders each new bookmark to HTML from the **hydrated `postView`** — text,
   images, quoted post, and external link card all arrive in the one call (no
   extra fetches).
4. POSTs each to `/api/ingest` as `source=bluesky`, with `externalId` = the
   post's `at://` URI (globally unique).

Flags: `--dry-run`, `--verbose`, `--max-pages N`.

### Auth / config

| Path | Holds |
|---|---|
| `~/.config/bluesky/env` | `BLUESKY_IDENTIFIER` (handle or DID), `BLUESKY_APP_PASSWORD`, optional `BLUESKY_PDS` (default `https://bsky.social`) |
| `~/.config/bluesky/token.json` | cached session `{ accessJwt, refreshJwt, did, handle }` |
| `~/.config/bluesky/state.json` | `seen_ids[]` high-water set, `last_run`, `total_ingested` |
| `~/.config/reader/env` | `READER_API_URL`, `READER_MCP_TOKEN` (shared with the X collector) |

Mint an app password at **Bluesky → Settings → App Passwords** (no special
scopes needed) and drop it into `env`. First run creates `token.json` and
`state.json` automatically. Deleted/blocked bookmarks are skipped (and marked
seen so they aren't retried).

## Mastodon bookmark collector (Sleeper-side)

`scripts/mastodon-bookmark-sync.mjs` — like Bluesky, free and friction-light:
auth is a personal access token, no OAuth dance, no per-call cost.

Each run:
1. Pages newest-first through the authed user's bookmarks (`GET /api/v1/bookmarks`),
   following the `Link: …; rel="next"` header for pagination (Mastodon paginates
   bookmarks by an **internal bookmark id** exposed only in that header — *not* the
   status id — so we never construct `max_id` ourselves). Stops once it reaches
   already-ingested ids (bounded by `FIRST_PAGE=40` / `--max-pages`).
2. Renders each bookmarked Status to HTML — content (already HTML), media,
   boosted post (`reblog`), and link `card` all arrive in the one object.
3. POSTs each to `/api/ingest` as `source=mastodon`, `externalId` = status id.

Flags: `--dry-run`, `--verbose`, `--max-pages N`.

### Auth / config

| Path | Holds |
|---|---|
| `~/.config/mastodon/env` | `MASTODON_INSTANCE` (e.g. `https://mastodon.social`), `MASTODON_ACCESS_TOKEN` |
| `~/.config/mastodon/state.json` | `seen_ids[]` high-water set, `last_run`, `total_ingested` |
| `~/.config/reader/env` | `READER_API_URL`, `READER_MCP_TOKEN` |

Get the token on **your instance → Preferences → Development → New Application**,
with the `read:bookmarks` scope, then copy *Your access token*. No client
id/secret needed for a single-user personal token. First run creates
`state.json`; bookmarks of deleted/unviewable statuses are skipped.

## Instapaper collector (Sleeper-side)

`scripts/instapaper-sync.mjs` — Instapaper *is* a save-for-later service, so this
is the most natural fit; saves carry the full article text.

Each run:
1. Obtains (or reuses) an OAuth 1.0a access token via **xAuth** (username +
   password → token, cached once). HMAC-SHA1 signing is hand-rolled with
   `node:crypto` (verified against the `oauth-1.0a` reference vector).
2. Lists the chosen folder (`bookmarks/list`, default `unread`).
3. For each *new* save, best-effort fetches the full article HTML
   (`bookmarks/get_text`) so Found cards have real bodies — falls back to the
   save's description.
4. POSTs each to `/api/ingest` as `source=instapaper`, `externalId` =
   `bookmark_id`.

Flags: `--dry-run`, `--verbose`, `--folder NAME` (`unread|starred|archive|<id>`),
`--no-text` (skip `get_text`).

### Auth / config

| Path | Holds |
|---|---|
| `~/.config/instapaper/env` | `INSTAPAPER_CONSUMER_KEY`, `INSTAPAPER_CONSUMER_SECRET`, `INSTAPAPER_USERNAME`, `INSTAPAPER_PASSWORD`, optional `INSTAPAPER_FOLDER` |
| `~/.config/instapaper/token.json` | cached `{ oauth_token, oauth_token_secret }` |
| `~/.config/instapaper/state.json` | `seen_ids[]`, `last_run`, `total_ingested` |
| `~/.config/reader/env` | `READER_API_URL`, `READER_MCP_TOKEN` |

**One external gate:** the consumer key/secret comes from Instapaper's
human-reviewed [request form](https://www.instapaper.com/main/request_oauth_consumer_token).
Until it's granted the collector throws on the missing key (and its timer is
harmless — the run just exits). Once the key lands, the username/password are
only needed for the first run; after that the cached `token.json` is used and the
password can be removed from `env`.

## Schedules (all three collectors)

systemd **user** timers, vendored under `scripts/systemd/`, staggered so they
don't fire on the same second:

| Timer | OnCalendar |
|---|---|
| `x-bookmark-sync.timer` | `07,19:30` |
| `bluesky-bookmark-sync.timer` | `07,19:40` |
| `instapaper-sync.timer` | `07,19:50` |
| `mastodon-bookmark-sync.timer` | `08,20:00` |

All `Persistent=true`, `RandomizedDelaySec=600`. Install any of them with:
```
cp scripts/systemd/<name>.{service,timer} ~/.config/systemd/user/
systemctl --user daemon-reload && systemctl --user enable --now <name>.timer
```
Ops: `journalctl --user -u <name>` to tail · `systemctl --user start
<name>.service` to run now · run the script with `--dry-run --verbose` to test
before enabling the timer.

## Tests

- `__tests__/components/BottomBar.test.ts` — four rooms in order, Found active only
  on its route, hidden on reader/login.
- `__tests__/components/FoundPage.test.ts` — Found-feed resolution (empty state +
  refetch vs. deck scoped to the `kind='found'` feed).

## Native app — TODO

The web app ships the Found tab in this deploy. A separate native build (the iOS
Reader app, built on Petter's local machine) needs the matching surface — see the
checklist in the sleeper-task and the "Native app integration" section below.

### Native app integration spec

To add the Found room to the native client:
1. **New tab** between Deck and Shelf, label **Found**, routing to a feed-scoped
   deck (reuse the existing feed/deck screen).
2. **Resolve the feed** by `kind === 'found'` from `GET /api/feeds` (the response
   now includes `kind` per feed). Do **not** hardcode a feed id — it's created
   lazily on first ingest and differs per user/environment.
3. **Empty state** when no `kind:'found'` feed exists yet ("Nothing found yet").
4. Everything else is free: Found articles already come back from the normal
   `GET /api/articles` list and the per-feed deck; the five verbs (save / read /
   elevate / skip / open) work unchanged. Tweet bodies are HTML in R2 and render
   through the same article reader.
5. Nothing to send on write — ingestion is entirely server-side.
