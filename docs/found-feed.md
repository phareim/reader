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
X bookmarks ──────┐
Bluesky ──────────┤
Mastodon ─────────┤
Reddit ───────────┼─→ [Sleeper collector(s)] ──POST /api/ingest──→ Reader (D1+R2) ──→ "Found" feed + tab
Instapaper ───────┤   normalize to one shape    (MCP-authed)         ↑ behaves like any feed
AI digest ────────┤   (synthesizes many → one)
Sleeper Articles ─┘   (extracted articles → one card each)
```

Adding a new source = a new collector that POSTs the same shape. **Zero Reader
changes.** Seven collectors ship today (`source=x-bookmark`, `bluesky`,
`mastodon`, `reddit`, `instapaper`, `ai-digest`, `sleeper-articles`); each is a
standalone `scripts/*-sync.mjs` + a systemd user timer. Five normalize *one social
item → one card*; the AI digest is the odd one out — it reads *many* items and
synthesizes *one* card; the Sleeper Articles collector mirrors *one
already-extracted article → one card* (see the sections below).

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

## X bookmarks (Worker-side — the odd one out)

X is the one source that is **not** a Sleeper-side collector anymore: users link
their own X account from the Sources page and the Worker syncs bookmarks itself.
(The old collector `scripts/x-bookmark-sync.mjs` + `x-bookmark-sync.timer` are
retired; the script stays in-repo as the reference implementation the Worker
port was taken from.)

### Link flow (OAuth2 PKCE)

- `GET /api/auth/x/start` — session-authed, open to every signed-in user
  (every linked account's reads bill the app owner's X account — accepted,
  like the TTS bill). Stashes verifier+state in a 10-min `x_oauth` cookie and
  redirects to X's authorize page (scopes
  `bookmark.read tweet.read users.read offline.access` — app-only Bearer
  **cannot** read bookmarks).
- `GET /api/auth/x/callback` — verifies state, exchanges the code, resolves
  the handle via `users/me`, upserts the per-user `XAccount` row (migration
  `010-x-accounts.sql`). Always redirects to `/sources?x=linked|error`.
- `GET /api/auth/x/link` / `DELETE /api/auth/x/link` — status for the Sources
  block / unlink (best-effort upstream revoke; ingested articles stay).

Config: `NUXT_X_CLIENT_ID` (wrangler `[vars]`) + `NUXT_X_CLIENT_SECRET`
(Worker secret). The redirect URI
`https://reader.phareim.no/api/auth/x/callback` must be registered on the X
app (developer.x.com → app → User authentication settings).

### Sync — `POST /api/internal/sync-x-bookmarks`

Bearer `NUXT_CRON_KEY`, called by the `reader-x-bookmarks.timer` systemd user
timer (07/19:30, units under `scripts/systemd/`, trigger
`scripts/sync-x-bookmarks.mjs` — same pattern as `reader-sync-stale`). Per
linked account:

1. Refreshes the OAuth2 token if near expiry. **X rotates the refresh token on
   every refresh** — the rotation is persisted to D1 immediately, and this
   endpoint must remain the token's *only* refresher (running the retired
   collector against the same token would kill it).
2. Pages newest-first through the account's bookmarks (25/page, ≤5 pages),
   stopping once a page isn't entirely new — "new" is a D1 guid check
   (`x-bookmark:<tweet id>` in the user's Found feed), which replaces the old
   collector's local `seen_ids` set. `since_id` is deliberately not used:
   bookmarking an *old* tweet surfaces a low id at the top of the newest-first
   list, which an id high-water mark would wrongly skip.
3. Renders each new tweet via `server/utils/xRender.ts` (pure, unit-tested in
   `__tests__/server/xRender.test.ts`) — quoted + reply/thread context carried
   in the one bookmarks call via expansions, native X Articles rendered
   long-form — and inserts into that user's Found feed.

A failed account (dead refresh token, 429, …) records `last_error` on its
`XAccount` row — surfaced on Sources as "Sync failing — try relinking" — and
never blocks other accounts.

### Cost

X v2 is pay-per-usage at **$0.005 per post returned**, billed to the app
owner regardless of which linked account is being read. Linking is open to
every signed-in user (accepted cost, like TTS); re-gate with `isPersonalUser`
in `start.get.ts` + `link.get.ts` if guest volume ever hurts. Twice-daily
polling of a 25-post first page bounds idle cost to ≈ $0.25/day per account
worst case; you only ever pay for posts actually returned.

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

## Reddit collector (Sleeper-side)

`scripts/reddit-saved-sync.mjs` — Reddit's analog to bookmarks is the **saved**
list, which holds both saved *posts* and saved *comments*.

Each run:
1. Mints an OAuth2 bearer token via the "script" app **password grant** (tokens
   last ~1h, so it mints fresh each run — no refresh-token bookkeeping).
2. Pages newest-first through `GET /user/{username}/saved` (`raw_json=1` so the
   embedded HTML isn't entity-encoded), following the `after` cursor; stops once
   it reaches already-ingested ids (bounded by `FIRST_PAGE=50` / `--max-pages`).
3. Renders each item by kind — `t3` posts (title, selftext, preview image,
   external link) and `t1` comments (body + thread title) — straight from the
   listing, no extra fetches.
4. POSTs each to `/api/ingest` as `source=reddit`, `externalId` = the fullname
   (`t3_…` / `t1_…`).

Flags: `--dry-run`, `--verbose`, `--max-pages N`.

### Auth / config

| Path | Holds |
|---|---|
| `~/.config/reddit/env` | `REDDIT_CLIENT_ID`, `REDDIT_CLIENT_SECRET`, `REDDIT_USERNAME`, `REDDIT_PASSWORD`, optional `REDDIT_USER_AGENT` |
| `~/.config/reddit/state.json` | `seen_ids[]` (fullnames), `last_run`, `total_ingested` |
| `~/.config/reader/env` | `READER_API_URL`, `READER_MCP_TOKEN` |

Create a **script** app at [reddit.com/prefs/apps](https://www.reddit.com/prefs/apps)
("create app" → type *script*). The client id sits under the app name; the secret
is shown beside it. The password grant requires you to be a developer of that app.
Reddit **requires a unique, descriptive `User-Agent`** or it 429s hard — the
script defaults to `reader-found-collector/1.0 (by /u/<username>)`; override via
`REDDIT_USER_AGENT`. **2FA:** if the account uses it, set `REDDIT_PASSWORD` to
`yourpassword:123456` (password:otp) for the run that mints the token.

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

## AI digest collector (Sleeper-side)

`scripts/ai-digest-sync.mjs` — the odd one out: instead of *one social item → one
card*, it reads *many SFL ideas → synthesizes → one card*. The recurring
AI-discovery job already drops `ai-news`-tagged ideas into SFL; this collector
reads the **tag** (not the producer, so the job can evolve underneath it), not a
single source. Each morning it:

1. pulls the last ~26h of `ai-news`-tagged ideas (`GET /api/ideas?tag=ai-news`);
2. asks an LLM (Venice.ai's OpenAI-compatible API, model `zai-org-glm-5-2`,
   plain `fetch` — no SDK dep) for a short, calm editor's-letter digest as an
   HTML fragment, grouped into 2–4 themes, each claim linked to its source url;
3. POSTs it as **one** card via `/api/ingest` with `source=ai-digest`,
   `externalId=<YYYY-MM-DD>` → guid `ai-digest:<date>`, **idempotent per day**.

Notes: the `ai-news` ideas are mostly `type:note` with `url=null` and the source
link buried in the body — `sourceUrl()` recovers it; `unwrapDeadLinks()` strips
any `href="#"` Claude invents despite the prompt. Empty window → posts nothing
(silence is the calm default). Claude failure → a deterministic linked-list
fallback still lands. Full design + open questions:
[`found-feed-ai-digest.md`](found-feed-ai-digest.md).

### Auth / config

| File | Holds |
|---|---|
| `~/.config/ai-digest/env` | `SFL_API_URL`, `SFL_API_KEY`, `VENICE_API_KEY` (falls back to shell `VENICE_API_TOKEN`), optional `DIGEST_MODEL` (default `zai-org-glm-5-2`) / `VENICE_API_URL` / `DIGEST_WINDOW_HOURS` |
| `~/.config/ai-digest/state.json` | `last_run`, `last_date`, `total_posted` |
| `~/.config/reader/env` | `READER_API_URL`, `READER_MCP_TOKEN` |

Flags: `--dry-run` (synthesize + print the HTML, don't POST), `--verbose`,
`--window-hours N`, `--date YYYY-MM-DD` (rebuild a specific day).

## Sleeper Articles collector (Sleeper-side)

`scripts/sleeper-articles-sync.mjs` — mirrors the **Sleeper Articles service**
(`~/chat/articles`, the SFL-bookmark extraction pipeline on `127.0.0.1:3003`,
public at `sleeper.phareim.no/articles/`) into Found. Where the social collectors
fetch a bookmark and extract it themselves, this one reads content the Articles
service has **already** extracted (full Markdown bodies, summaries, key points).
Each run:

1. pages the articles list newest-first (`GET /?status=ready&cursor=…` — cursor
   pagination via `next_cursor` / `has_more`), stopping once a page isn't entirely
   new (bounded by `--page-size` / `--max-pages` / `--max-items`);
2. fetches each new item's full doc (`GET /:id` — the list view strips
   `content_md`) and renders **by kind**: `article`/`digest` bodies via a vendored
   dependency-free Markdown→HTML converter (`mdToHtml` — `marked` isn't a Reader
   dep), `video` as a thumbnail + link card, `post` as an X-style card from
   `doc.post_data`. Lead image is recovered from the markdown; summary from
   `doc.summary` / `doc.sfl_summary`;
3. POSTs each via `/api/ingest` as `source=sleeper-articles`,
   `externalId=<article id>` → guid `sleeper-articles:<id>`, **idempotent**.

The list/read endpoints are public today, so `ARTICLES_API_KEY` is optional.
**First run:** the service already holds hundreds of ready items, so run once with
`--seed` to mark the current backlog seen *without* ingesting (baseline; done
2026-07-01 — 500 seeded, 3 kept as a live test). Normal runs then pull only new
articles.

**Overlap caveat:** these articles originate from SFL bookmarks, and Reader's
swipe-up elevate writes *back* to SFL — so the loop is real, though guid-dedup
keeps it safe. The same X post can appear both as an `x-bookmark` card and a
`sleeper-articles` `post` card; drop `kind=post` in the collector if that
redundancy is unwanted.

### Auth / config

| File | Holds |
|---|---|
| `~/.config/sleeper-articles/env` | `ARTICLES_API_URL` (default `http://127.0.0.1:3003`), optional `ARTICLES_API_KEY` (Bearer) |
| `~/.config/sleeper-articles/state.json` | `seen_ids[]` (article ids), `last_run`, `total_ingested` |
| `~/.config/reader/env` | `READER_API_URL`, `READER_MCP_TOKEN` |

Flags: `--dry-run` (fetch + render + print, don't POST), `--verbose`, `--seed`
(baseline the backlog), `--page-size N` (default 50), `--max-pages N` (default 8),
`--max-items N` (default 60).

## Schedules (all collectors)

systemd **user** timers, vendored under `scripts/systemd/`, staggered so they
don't fire on the same second:

| Timer | OnCalendar |
|---|---|
| `ai-digest-sync.timer` | `06:30` (daily — first in Found at breakfast) |
| `reader-x-bookmarks.timer` | `07,19:30` (Worker-side X sync; replaced `x-bookmark-sync.timer`) |
| `bluesky-bookmark-sync.timer` | `07,19:40` |
| `instapaper-sync.timer` | `07,19:50` |
| `mastodon-bookmark-sync.timer` | `08,20:00` |
| `reddit-saved-sync.timer` | `08,20:10` |
| `sleeper-articles-sync.timer` | `08,20:20` |

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
- `__tests__/server/xRender.test.ts` — X bookmark → Found-item rendering (the
  Worker-side port): context blocks, media, link filtering, native X Articles.

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
