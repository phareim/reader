# The Reader, rebuilt — Tufte Viz ground-up UX redesign

**Date:** 2026-06-09
**Status:** Approved (brainstormed with Petter via visual companion)
**Supersedes:** `2026-06-05-almanac-ux-rebuild-design.md` (the Almanac card-stack build)

## Why

The Almanac rebuild (2026-06-05) kept too much of the old app's skeleton — it reads as
a layer of paint. The menus stayed cluttered, the AI-summary surfaces added noise, and
above all the card physics never developed real card feel, especially on mobile.

The goal is a **calm, delightful reading experience** with exactly three core verbs:

1. **Read quickly** — move through one stream with minimal friction.
2. **Save what touches me** — a personal shelf inside the reader.
3. **Elevate what is meaningful to SFL** — the promotion gesture into the knowledge
   pipeline (SFL → sleeper-articles → `thoughts/raw/` → wiki).

The swipeable-card idea survives; its implementation does not.

## Decisions (made during brainstorm)

| Question | Decision |
|---|---|
| Reading model | Swipeable card deck stays; physics rebuilt wholesale |
| Design system | Tufte Viz brand layer (ET Book, `--tufte-*` tokens), replacing Almanac |
| App structure | **Three rooms** — Deck / Shelf / Sources behind a thin bottom bar; no drawer/hamburger |
| Deck scope | Always **all unread, newest first** — one stream, no feed/tag scoping, no decisions |
| Card content | Full-bleed lead image to the card borders with source + headline overlaid on a gradient scrim; typographic fallback when no image; excerpt + reading time below; **no filler images** |
| Gesture verbs | ← save · → read · ↑ elevate to SFL · ↓ skip · tap opens reader |
| Physics engine | **Motion for Vue (`motion-v`)** — drag with velocity, interruptible springs |
| AI summaries | Scrapped entirely (OpenAI newsletter summaries, Workers-AI tag summaries, `/api/claude`) |
| List pages | Per-feed / per-tag article list pages deleted; Sources is management only |

## 1. Visual foundation

- Vendor the Tufte Viz brand layer into `public/tufte/`: ET Book woff/woff2 fonts,
  token CSS (light paper + `tufte-dark` midnight palette). Source:
  `~/.claude/skills/tufte-viz/` (`tokens/*.css`, `styles.css`, `assets/fonts/`).
- A Tailwind preset `config/tufte.preset.cjs` (replacing `config/almanac.preset.cjs`)
  maps tokens to the utility names already idiomatic in this codebase: `bg-paper`,
  `text-ink`, `text-mute`, `border-rule`, accent color, `font-serif` → ET Book stack
  (fallback Charter → Palatino → Georgia).
- `assets/css/tufte.css`: `@font-face` (regular, italic, bold; `font-display: swap`)
  plus the dark palette under `@media (prefers-color-scheme: dark)`. Dark mode remains
  **system-preference only**; no manual toggle.
- Delete all Almanac vendored assets (`public/almanac/`, `assets/css/almanac.css`,
  `config/almanac.preset.cjs`) and `components/almanac/`.
- New Tufte primitives in `components/tufte/` (auto-imported without path prefix, as
  the Almanac ones were): `MonoLabel` (small tracked uppercase mono), `HairlineRule`,
  `ActionLabel` (the button substitute: mono label in a hairline border, optional
  accent), `CardFrame` (hairline-framed paper surface, no radius, no shadow).
- Design language rules: hairline 1px rules, never boxes with shadows or rounded
  buttons; at most **one accent** per screen at the moment of attention; ordered
  grayscale elsewhere.

## 2. Structure — three rooms + reader

```
┌─ Deck (/)            the entrance: the card stack
├─ Shelf (/shelf)      saved articles
├─ Sources (/sources)  feed & tag management, account
└─ Reader (/article/:id)  full-screen reading (no bottom bar)
```

- `components/BottomBar.vue`: thin bar, hairline top border, three mono labels
  `DECK · SHELF · SOURCES`; active room gets the accent. Visible in the three rooms,
  hidden in Reader and `/login`.
- Pages kept: `index.vue` (rebuilt), `article/[id].vue` (rebuilt), `login.vue`
  (reskinned), `mcp-settings.vue` (reskinned, linked from Sources). Pages added:
  `shelf.vue`, `sources.vue`. Pages deleted: `saved.vue`, `feed/[id].vue`,
  `tag/[name].vue`, `test/*`.
- All current `components/` are torn down (`almanac/`, `stack/`, `menu/`, `article/`,
  `feed/`, `layout/`, `common/`, `SwipeIndicator.vue`, …) and rebuilt fresh.

## 3. The deck

**Data.** All unread articles for the user, newest first, from
`useArticles().fetchArticles()` with no feed filter. No scoping. Refreshing (pull
gesture on the empty state / `shift+r`) triggers `/api/sync`.

**Rendering.** Top ~3 cards as stacked paper: each lower card offset a few px and
slightly scaled down, hairline borders, no shadows. When the deck empties,
`DeckEmptyState` (glyph + serif line + `— SYNC ALL` action label).

**Physics (the heart of the rebuild).** The top card is a `motion-v` drag target:

- Follows the pointer 1:1 while dragging, with rotation proportional to horizontal
  offset (≈ `dx / 20` degrees, clamped) and the card's grab point respected.
- **Release resolution is velocity-aware**: a fast flick commits its direction even
  below the distance threshold; a slow drag commits past the distance threshold;
  otherwise the card springs back. Springs are interruptible — grabbing a card
  mid-spring-back picks it up where it is.
- On commit the card flings off-screen continuing its release velocity; the next card
  springs up into top position (subtle scale + translate, spring not ease).
- During a drag the **pending verb** fades in as the screen's single accent (a mono
  `ActionLabel` near the relevant edge), proportional to progress toward commit.
- Spring constants and thresholds live as named constants in `utils/deck.ts` so they
  are tunable in one place and testable.

**Pure logic** stays in `utils/deck.ts`, extended:

- `resolveDirection(dx, dy, vx, vy, thresholds)` — distance OR velocity commit.
- `advance(deckIds, action)` / `undo(history)` as today.
- Full unit coverage in `__tests__/utils/deck.test.ts`.

**Verbs** — all routed through `CardStack.commit(direction)`; desktop arrow keys and
the on-screen action labels drive the same path:

| Gesture / key | Verb | Effect |
|---|---|---|
| swipe ← / `←` | **Save** | `useSavedArticles().save(id)`, card leaves deck |
| swipe → / `→` | **Read** | `markAsRead(id, true)`, card leaves deck |
| swipe ↑ / `↑` | **Elevate to SFL** | `POST /api/articles/:id/elevate`, marks read, card leaves deck |
| swipe ↓ / `↓` | **Skip** | card moves to back of deck, no API call |
| tap / `o` | **Open reader** | navigate `/article/:id`, non-destructive |
| `u` / toast | **Undo** | reverses the last save / read / elevate |

**Undo.** After save / read / elevate, a quiet `— UNDO` toast (~5 s). Undo restores
the card to the top and reverses the API effect (unsave / mark unread / delete the
SFL idea + mark unread).

## 4. The card

Two variants sharing one skeleton (`ArticleCard.vue` inside `CardFrame`):

**With lead image** (from the article's RSS enclosure/media or extracted lead image):

- Image bleeds edge-to-edge to the card's top and side borders (inside the hairline),
  fixed height ≈ 55% of card, `object-fit: cover`, slightly desaturated (`saturate(.85)`).
- Bottom-up gradient scrim (`rgba(20,16,10,.78) → transparent`) for legibility.
- Overlaid on the image, bottom-aligned: source mono label (`— THE ATLANTIC · 2H AGO`)
  and the serif headline in warm white.
- Below, on paper: 3–4 line excerpt (muted serif), then reading-time mono footer.

**Without image:** purely typographic — source/date mono line, serif headline,
hairline rule, excerpt, reading-time footer. **Never** a placeholder or stock image.

**Reading time:** `ceil(wordCount / 220)` minutes, computed from full text when
available (R2), omitted when only a thin excerpt exists. Shown as `12 MIN READ`.

## 5. The reader (`/article/:id`)

- Full-screen, no bottom bar. Serif column ~65ch, generous leading, `@tailwindcss/
  typography` restyled to the Tufte tokens (ET Book, accent links, hairline rules).
- Content DOMPurify-sanitized client-side. If the stored body is thin (RSS excerpt),
  fire `POST /api/articles/:id/fetch-fulltext` on open and swap in the result.
- Quiet action row (mono `ActionLabel`s) at top: back, save/unsave, **elevate**,
  open original. Opening from the deck is non-destructive — returning lands on the
  same card. Opening an article does not auto-mark it read; leaving via → (or the
  reader's "read" action) does.
- Keyboard: `esc`/`backspace` back, `s` save, `e` elevate, `v` open original.

## 6. Elevate to SFL

New server route **`POST /api/articles/:id/elevate`**:

1. Authenticated via the standard `getAuthenticatedUser()`.
2. Creates an SFL idea: `type=page`, body/url = article URL, title = article title —
   via the SFL HTTP API (`SFL_API_URL` + `SFL_API_KEY` Worker secrets; the reader
   deploys to Cloudflare, not Sleeper, so these are `wrangler secret`s and `.env.local`
   entries in dev).
3. Marks the article read locally (same code path as the read verb).
4. Returns the created SFL idea id; the client keeps it in undo history.

**Undo of elevate** = `DELETE` the created idea via the SFL API + mark unread. If the
delete fails (network, API), the undo still restores the card locally and surfaces a
quiet error toast; no retry queue in v1.

**Downstream (no work needed):** SFL `type=page` ideas are already polled by
`sleeper-articles`, extracted, and folded into `~/thoughts/raw/` → wiki. Elevating
from the reader feeds the whole cognition stack.

Failure mode: if SFL is unreachable, the elevate commit fails — the card springs back
and an error toast shows. No optimistic elevate (unlike save/read), because the
downstream pipeline makes phantom successes costly.

## 7. The shelf (`/shelf`)

- Saved articles as **hairline-separated typographic rows** — no boxes, no images:
  serif title, mono source + relative date, muted excerpt line.
- Optional flat tag filter: a single quiet row of mono tag labels above the list
  (`ALL · TECH · ESSAYS …`); active tag gets the accent. Uses the existing
  saved-article tag APIs.
- Row tap opens the reader. Per-row quiet actions: unsave, edit tags (minimal inline
  affordance, not a dropdown menu).

## 8. Sources (`/sources`)

Management only — never article browsing:

- **Add feed**: one input + discover/add (existing `FeedUrlInput` behavior, rebuilt
  visually; uses `/api/feeds/discover` + `POST /api/feeds`).
- **Feed list**: flat, grouped by tag (untagged under `— INBOX`), each row: favicon
  (feed's own only), serif name, mono unread count. Per-row quiet actions:
  mark-all-read, edit tags, delete. No collapsible folders, no dropdown menus.
- **Footer**: sync-all action, signed-in email, sign out, link to `/mcp-settings`.

## 9. Backend teardown & survivals

**Delete** (routes + supporting utils + deps):

- `POST /api/articles/summarize`, `server/utils/summarization.ts`, the OpenAI SDK
  dependency and `OPENAI_API_KEY` handling.
- `POST /api/tags/:name/summary` (Workers-AI tag summaries). The `AI` binding is
  removed from `wrangler.toml` unless something else uses it (nothing does today).
- `POST /api/claude` and the Anthropic SDK dependency.
- `GET /api/unsplash/random` and all Unsplash fallback logic (incl. the feedParser
  favicon fallback — a feed without a favicon simply shows none).

**Keep untouched:** D1 schema, auth/session/password utils, feed sync + parser
(minus Unsplash fallback), full-text fetch + R2 article content, saved-articles +
tags APIs, MCP server + token routes, PWA setup, deploy workflow.

**Dependency hygiene:** while in `package.json`, run the npm-audit / dependabot pass
(73 reported vulns, 1 critical) and apply non-breaking updates.

**New dependency:** `motion-v` (Motion for Vue). New secrets: `SFL_API_URL`,
`SFL_API_KEY`.

## 10. Keyboard shortcuts (rebuilt small)

Deck: `← → ↑ ↓` verbs, `u` undo, `o`/`enter` open, `shift+r` sync all.
Reader: `esc` back, `s` save, `e` elevate, `v` original.
Global: `?` help overlay (rebuilt minimal). The `j/k` list-navigation model dies with
the list pages; Shelf rows are plain links.

## 11. Testing

- `utils/deck.ts`: full unit coverage — velocity-aware `resolveDirection` (flick
  commit, slow-drag commit, spring-back), `advance`, `undo`, threshold constants.
- `CardStack` component test with mocked composables: each commit direction calls the
  right composable method; undo reverses it; elevate failure springs back.
- Existing test setup (Jest + ts-jest + jsdom) unchanged.

## 12. Out of scope (explicitly)

- Deck scoping by feed/tag (revisit only if missed in daily use).
- Any AI summarization surface.
- Manual theme toggle, notes on saved articles, retry queues for SFL.
- Changes to `sleeper-articles`, `thoughts-sync`, or the SFL service itself.

## Build order (suggested for the implementation plan)

1. Visual foundation: vendor Tufte assets, preset, primitives, app shell + bottom bar.
2. Backend teardown (AI routes, Unsplash, deps) + audit pass — green tests.
3. Deck logic extension (`utils/deck.ts` velocity) — TDD.
4. CardStack + ArticleCard + physics with `motion-v`; tune on a real phone.
5. Reader rebuild.
6. Elevate route + SFL client + undo path.
7. Shelf, Sources, login/mcp-settings reskin.
8. Keyboard shortcuts + help overlay; delete dead pages/components; docs update
   (CLAUDE.md) + deploy.
