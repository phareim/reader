# Plan — the morning AI digest (a synthesized Found card)

> Status: **plan, not yet built.** Companion to [`found-feed.md`](found-feed.md).

## What we're building

Each morning, one **synthesized digest card** lands in the Found feed: a short
editor's-letter over the last 24h of AI news, styled like the obsession brief.
One swipe to read it in the serif reader, elevate it to SFL, or skip.

It is **not** a new kind of feature — it is a **sixth Sleeper-side collector**
in the exact mould of the five that already feed Found (X / Bluesky / Mastodon /
Reddit / Instapaper). The only twist: where those normalize *one social item →
one card*, this one **reads many SFL ideas → synthesizes → posts one card**. The
Reader stays completely source-agnostic; zero Reader-app changes.

```
  SFL  ──GET /api/ideas?tag=ai-news──►  scripts/ai-digest-sync.mjs  ──POST /api/ingest──►  Found feed
 (the recurring AI-discovery job          (read window → Claude            (one dated card,
  already drops ai-news ideas here)        synthesis → HTML)                source='ai-digest')
```

## The source (decided)

Read the **SFL `ai-news` stream**, not any single producer. The recurring
AI-discovery job already deposits `ai-news`-tagged ideas into SFL (they flow on
downstream into `sleeper-articles` → `~/thoughts/raw/` → the monthly wiki fold).
By reading the tag rather than the job, the digest is robust to *how* those
ideas arrive — cloud routine, agent, or a manual save all work, and a future
change of producer needs no change here.

- **Read:** `GET ${SFL_API_URL}/api/ideas?tag=ai-news&limit=80` (Bearer
  `SFL_API_KEY`). `listIdeas` already supports `tag` + `limit` (see
  `~/github/sfl/api/src/routes/ideas.js:36`). Each idea carries `created_at`
  (epoch ms) + `title` + `summary` + `url` + `data`.
- **Window:** filter client-side to `created_at >= now - 24h` (plus a small
  overlap, e.g. 26h, so a slightly-late run never drops items). If a window is
  empty, **post nothing** — silence is the calm default.

## The synthesis

Runs on Sleeper, so it can call Anthropic directly (the Reader Worker
deliberately has no AI binding — that constraint does not apply here).

- **SDK:** `@anthropic-ai/sdk` — already vendored at
  `~/sfl-hook/node_modules/@anthropic-ai/sdk`; the collector gets its own
  `node_modules` or reuses the repo's.
- **Key:** `ANTHROPIC_API_KEY` from `~/.config/write/env` (also present in
  `~/.config/sfl/hook.env`). Loaded by the script, never hardcoded.
- **Model:** `claude-sonnet-4-6`, one non-streamed call, cached system block
  (mirrors the sfl-hook / write-api convention).
- **Prompt:** system block sets the voice — *a calm, declarative morning brief
  for one reader; group the day's items into 2–4 themes; lead with the single
  thing most worth knowing; link every claim back to its source URL; no hype, no
  filler.* User block is the JSON list of `{title, summary, url}` from the window.
- **Output contract:** Claude returns **clean HTML** (an `<h2>`/`<h3>` + `<p>` +
  `<ul><li><a>` structure) — no `<html>`/`<body>` wrapper. This renders directly
  through the reader's `@tailwindcss/typography` prose styling and the
  display-time DOMPurify pass, exactly like an X-bookmark body. A deterministic
  **fallback** (just the linked list of titles, no prose) is emitted if the
  Claude call fails, so a model outage still produces a useful card.

## The write

`POST ${READER_API_URL}/api/ingest` with the MCP token (creds from
`~/.config/reader/env` — `READER_API_URL` + `READER_MCP_TOKEN`, reused from the
other collectors). Payload:

| field        | value |
|--------------|-------|
| `source`     | `'ai-digest'` (records per-item origin, per the Found convention) |
| `externalId` | the digest date, `YYYY-MM-DD` → guid `ai-digest:2026-06-29`, **idempotent per day** |
| `title`      | `AI digest · <weekday> <D Mon>` (e.g. `AI digest · Mon 29 Jun`) |
| `content`    | the synthesized HTML |
| `summary`    | the lead sentence (Claude's one-line "most worth knowing"), ≤ 2000 chars |
| `url`        | a stable per-day anchor — see Open question 1 |
| `imageUrl`   | omit (typographic card; the deck renders a clean head, no hero) |
| `publishedAt`| the run timestamp |

The card lands **unread**, neither saved nor read — it flows into the Found tab
and the main Deck like everything else. The five verbs work: swipe-up **elevates
the digest into SFL → wiki**, which is a nice loop (a synthesis of ai-news can
itself become a durable note).

## Idempotency & re-runs

- guid `ai-digest:<date>` + the existing `UNIQUE(feed_id, guid)` means a second
  run the same day is a **no-op insert** — safe to retry, safe to run the timer
  with `Persistent=true`.
- **Caveat to verify:** `/api/ingest` today *ignores* a duplicate guid (it does
  not update). So if the morning's first run fired before late items landed, a
  re-run will **not** refresh the card. Acceptable for v1 (one clean run/morning).
  If we later want "rebuild today's card," add an `upsert` path to ingest — out
  of scope here, noted in Open question 2.

## Config

New file `~/.config/ai-digest/env` (one per collector, matching the house style):

```
SFL_API_URL=https://sfl-api.aiwdm.workers.dev
SFL_API_KEY=<the SFL key>            # same key the Reader's elevate uses
ANTHROPIC_API_KEY=<...>             # or sourced from ~/.config/write/env
DIGEST_MODEL=claude-sonnet-4-6      # optional override
DIGEST_WINDOW_HOURS=26             # optional override
```

`READER_API_URL` + `READER_MCP_TOKEN` continue to come from
`~/.config/reader/env` (shared, as the other collectors do).

## Schedule

A systemd **user** timer, once each morning, vendored under
`scripts/systemd/` like its siblings:

- `scripts/systemd/ai-digest-sync.service` — `ExecStart=node %h/github/reader/scripts/ai-digest-sync.mjs`
- `scripts/systemd/ai-digest-sync.timer` — `OnCalendar=*-*-* 06:30:00`, `Persistent=true`
  (06:30 local, before the 07:xx social-collector wave, so the digest is the
  first thing in Found at breakfast).

Enable: `cp scripts/systemd/ai-digest-sync.{service,timer} ~/.config/systemd/user/ && systemctl --user daemon-reload && systemctl --user enable --now ai-digest-sync.timer`.
Tail: `journalctl --user -u ai-digest-sync`. Run now: `systemctl --user start ai-digest-sync.service`.

## Flags (match the collector convention)

- `--dry-run` — fetch + synthesize + print the HTML, **do not** POST.
- `--verbose` — log the window size, the items, token usage.
- `--window-hours N` — override the look-back.
- `--date YYYY-MM-DD` — rebuild for a specific day (testing / backfill).

## Edge cases & failure modes

1. **Empty window** → post nothing, exit 0. (No "nothing happened today" card.)
2. **Claude call fails** → emit the deterministic linked-list fallback so a card
   still lands; log the error.
3. **SFL unreachable** → exit non-zero, post nothing; the timer's `Persistent`
   + next morning recover. (A missed day is a missed newsletter, not a crash.)
4. **Reader ingest 401/5xx** → log + exit non-zero; idempotent guid makes the
   next run safe.
5. **Thin/garbage items** — the prompt instructs Claude to drop low-signal
   entries rather than pad; we don't pre-filter in code beyond the time window.
6. **De-dup against the wider Found feed** — out of scope; the digest is a
   synthesis layer, overlap with raw social cards is expected and fine.

## Open questions (small)

1. **`url` for the card.** `/api/ingest` requires a valid URL (`z.string().url()`).
   Options, pick one in implementation:
   - a stable `https://sfl.hareim.no/...`-style anchor per day (works, but the
     "view original" verb would 404);
   - the single most-important item's URL (so "view original" opens the top
     story — my recommendation);
   - a `sleeper://digest/<date>` scheme (clean semantics, but verify zod's
     `.url()` accepts a custom scheme before relying on it).
2. **Rebuild-today.** Whether to teach `/api/ingest` an upsert path so a re-run
   refreshes the day's card with later items. Deferred; v1 is one run/morning.
3. **Cadence.** Daily is the ask. If mornings get noisy we can move to a Mon–Fri
   `OnCalendar` or fold weekends into a Monday catch-up — trivial timer edit.

## Implementation checklist

1. `scripts/ai-digest-sync.mjs` — read window → synthesize → ingest, with the
   four flags, the fallback path, and `~/.config/ai-digest/env` loading.
2. `scripts/systemd/ai-digest-sync.{service,timer}`.
3. Create `~/.config/ai-digest/env` (manual, secrets — a one-line task note like
   the other collector activation tasks).
4. `--dry-run --verbose` against a real 24h window; eyeball the HTML in the
   reader (paste into a scratch article or temporarily POST then read).
5. One real run; confirm the card appears in Found + Deck, reads well, and
   elevate→SFL works.
6. Enable the timer.
7. Doc: add an "AI digest" row to the collector list in
   [`found-feed.md`](found-feed.md) and a one-liner in the repo `CLAUDE.md`
   "Found feed" section (the digest is `source='ai-digest'`).

## Why this shape

- **Zero Reader changes** — it rides the `/api/ingest` seam that already exists,
  so the whole thing is one Sleeper-side script + a timer.
- **Source-agnostic** — reads the `ai-news` *tag*, not the producing job, so the
  recurring discovery job can evolve freely underneath it.
- **Calm** — one card, pre-digested, the obsession-brief voice. It says less and
  finishes more, in keeping with the "quieter Sleeper" ethos.
