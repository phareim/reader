# Anthropic article pipeline — design

**Date:** 2026-07-28 · **Status:** approved (delivery mechanism + source list chosen by Petter)

## Problem

Petter reads Anthropic's publications with interest when they drop, but the reader has no
Anthropic source at all. `anthropic.com/news` and `/engineering` publish **no RSS**;
`alignment.anthropic.com` has none either (every path returns the SPA shell);
`red.anthropic.com` is folded into the main site (301 → `/research/team/frontier-red-team`).
Only `transformer-circuits.pub` serves a real feed (`/feed.xml`).

Today Anthropic articles arrive by accident — link-blogs, tech-press rewrites, or Found-feed
collector cards. The example (article 359078) is a `sleeper-articles` card for the Opus
product page whose markdown conversion mangled the body; Found cards skip full-text fetch,
so it stays mangled.

Generic extraction of an `anthropic.com/news` article page (verified against
`redeploying-fable-5`): body text/headings/links come through, but an "Update" banner
renders as a broken list, a "Related content" card section with inline SVG arrows survives
at the tail, and **footnotes are lost** — Anthropic renders them client-side from Next.js
flight data (`self.__next_f`), so they never reach the DOM Readability sees.

## Design

Three parts, all inside the reader (no new repos or infra):

### 1. RSS bridge — `GET /api/bridge/anthropic/[section]`

Nitro route, sections `news` | `engineering` | `alignment`. Public (feed sync fetches
without cookies; the data is public). Each request fetches the upstream listing page
(browser UA, `FETCH_TIMEOUT`), parses it, and renders minimal RSS 2.0 — title, link,
guid (= link), pubDate when known, description when the listing offers one. Item cap 20
(newest first) so a fresh subscribe doesn't flood the deck. Upstream failure → 502, so
feed sync records the error and Sources shows the health note. `Cache-Control:
public, max-age=1800` as a courtesy.

Parsing (pure, in `server/utils/anthropicBridge.ts`, linkedom/worker like `blogroll.ts`):

- **news / engineering** — anchors `a[href^="/news/"]` / `a[href^="/engineering/"]`
  from the server-rendered listing (title from anchor text/heading). Dates mined from the
  flight-data payload: `"publishedOn":"…"` values keyed by slug (news carries full ISO
  timestamps, engineering `YYYY-MM-DD`). A slug without a date gets no pubDate —
  feed-extractor then stamps it at first sight, which is honest discovery-time ordering.
- **alignment** — homepage `a.note` anchors (`h3` title, `.description` body), with
  month-granularity `div.date` dividers associated by document order (fixture-verified).

The reader subscribes to its own bridge URLs (same-zone subrequest, 1 upstream fetch per
sync, well inside budget).

### 2. `anthropic` feed rig — `server/utils/feedRigs/anthropic.ts`

Owns host `anthropic.com`. `extract` hook only (bridge entries are link-only, so every
body arrives via full-text fetch):

- Scope to the page's `<article>` element — this alone drops the "Related content" tail.
- Transform the update-banner list into honest prose (`<p><em>Update (date): …</em></p>`).
- Strip inline `<svg>` icons and empty wrapper cruft.
- **Footnotes**: mine the flight-data chunks for the footnotes portable-text payload,
  render as a trailing `<h2>Footnotes</h2><ol>…</ol>`; the in-text `<sup>` markers already
  survive. Any parse failure skips footnotes silently.
- Lead image from `og:image` (cdn.sanity.io asset).
- Fail soft everywhere: any throw/null falls back to generic Readability, per the rig
  safety model.

### 3. Subscriptions (after deploy)

- `https://reader.phareim.no/api/bridge/anthropic/news`
- `https://reader.phareim.no/api/bridge/anthropic/engineering`
- `https://reader.phareim.no/api/bridge/anthropic/alignment`
- `https://transformer-circuits.pub/feed.xml` (direct — real Atom feed)

Backlog etiquette: after initial import, items older than 30 days are marked read via
`mark-all-read { articleIds }` so the deck gets the recent drops, not a 60-card flood.

## Out of scope

- Fixing the `sleeper-articles` markdown converter (separate codebase on Sleeper); with a
  real Anthropic feed the collector path stops being the primary arrival route.
- Cross-feed URL dedup (a Found card and a bridge article for the same URL can coexist;
  Found dedup is deliberately scoped to the Found feed).
- Rigs for `alignment.anthropic.com` / `transformer-circuits.pub` article pages — Distill
  templates extract acceptably; revisit only if a real article renders badly.
- Retroactively fixing article 359078 (permanently mangled Found card; the same launch is
  covered properly by the news bridge going forward).

## Testing

- `__tests__/server/anthropicBridge.test.ts` — trimmed real fixtures for all three
  listings: item extraction (count/title/absolute URL/date), flight-date mining, XML
  escaping, cap-at-20, garbage-in → empty list (fail soft).
- `feedRigs.test.ts` additions — trimmed real article fixture: related-content gone,
  update banner transformed, footnotes recovered from flight data, sup markers intact,
  og:image lead, garbage → null.
- CI gates deploy on the suite, as always.
