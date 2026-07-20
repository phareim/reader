# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**The Reader** — a calm, self-hosted RSS reader built with Nuxt 3, Vue 3, and Cloudflare (Workers + D1 + R2). The entrance is a swipeable **card deck** of unread articles (one card, five verbs); supporting rooms are the **shelf** (saved articles) and **sources** (feed management). The whole surface is styled in the **Tufte Viz design system** (warm paper, ET Book serif, hairline rules, one crimson accent per screen). Deployed at `reader.phareim.no`.

## Development Commands

```bash
# Start development server (runs on http://localhost:3000 or 3001 if 3000 is taken)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# MCP server for Claude Desktop
npm run mcp

# Tests (Jest + ts-jest + @vue/vue3-jest, jsdom)
npm run test
npm run test:watch
npm run test:coverage

# Run a single test file / pattern
npx jest __tests__/utils/deck.test.ts
npx jest -t "name of test"
```

Tests live in `__tests__/` mirroring the source tree. Current suites:
- `__tests__/utils/deck.test.ts` — pure deck state machine (`resolveDirection`, `advance`, `undo`)
- `__tests__/utils/grid.test.ts` — grid-view pure logic (`resolveGridDirection` distance/flick/wrong-sign-flick/diagonal-dominance, `nextPageOffset` read/saved/extraOffset accounting, `dedupeAppend` reference-preserving merge)
- `__tests__/utils/cardData.test.ts` — card derivations (`stripHtml`, `readingTimeMinutes`, `cardImageUrl`, `excerpt`)
- `__tests__/server/feedImage.test.ts` — lead-image extraction from raw feed entries (fast-xml-parser `@_` attribute shape, arrays, media:group, enclosures, content fallback)
- `__tests__/server/xRender.test.ts` — X bookmark → Found-item rendering (`server/utils/xRender.ts`): author line/escaping/note_tweet, quoted + replied-to context blocks, media + lead image, link filtering/dedupe, native X Article rendering incl. the heading heuristic
- `__tests__/server/redditRender.test.ts` — Reddit saved item → Found-item rendering (`server/utils/redditRender.ts`): t3 self/link/image posts (selftext_html, preview image, external-link line), t1 comments with thread context, escaping, unrenderable-child nulls
- `__tests__/server/hn.test.ts` — Hacker News favorites (`server/utils/hn.ts`): id scrape off the favorites page (both quote styles), More-link detection, Firebase item → Found-item rendering (link story vs Ask HN, comment/deleted/dead skips)
- `__tests__/server/githubStars.test.ts` — GitHub starred repos → Found-item rendering (`server/utils/githubStars.ts`): star+json vs plain-repo shapes, starred_at → publishedAt, escaping, star-count compaction, homepage-link filtering, unrenderable-entry nulls
- `__tests__/components/CardStack.test.ts` — commit/undo wiring, race guards, elevate failure paths
- `__tests__/components/DeckScreen.test.ts` — DeckScreen tag prop, 404→notFound emit, snapshot pattern, deck/grid toggle, grid keyboard branching, re-snapshot on grid→deck return, feed-scoped shift+R (refreshFeed for pull feeds, full sync for the push-only Found feed)
- `__tests__/components/MiniCard.test.ts` — grid mini card: image vs typographic variant, Unsplash-filler filtering, footer (feed · age), no excerpt
- `__tests__/components/ArticleGrid.test.ts` — grid commit wiring (save/read + undo toast), busy guard, LIFO undo, tap→reader, IntersectionObserver sentinel → `loadMore`, empty state
- `__tests__/components/TagEditorOverlay.test.ts` — chips, suggestion filtering, keyboard (Enter/comma/arrows/Backspace/Esc), save/close emits
- `__tests__/components/HighlightNoteOverlay.test.ts` — quote display, save emits trimmed note, Cmd/Ctrl+Enter commit, saving-guard
- `__tests__/components/RsvpOverlay.test.ts` — ORP split rendering, play/pause + done→restart (fake timers), wpm keys with clamping + localStorage persistence, word skips, Esc/Close emits
- `__tests__/utils/rsvp.test.ts` — `tokenizeWords`, `orpIndex` (length convention, punctuation skipping), `wordDelayMs` (sentence/clause/long-word dwell)
- `__tests__/utils/tts.test.ts` — `chunkTextForTts` (sentence-boundary packing, whitespace normalization, over-long sentence/word hard-splits, no-word-loss round-trip), `locateChunks` (chunk → raw-text offset spans through whitespace normalization, moving-cursor repeats, contiguous coverage)
- `__tests__/utils/hashtags.test.ts` — `extractHashtags` (dedupe, unicode, punctuation/url boundaries), `renderNoteHtml` (escape + accent-span wrap)
- `__tests__/utils/highlightDom.test.ts` — `paintHighlight` (exact + indexOf fallback, cross-element spans), `unpaint`/`clearHighlights` round-trips, `rangeForOffsets` (offset span → DOM Range across element boundaries, no DOM mutation)
- `__tests__/utils/truncation.test.ts` — `looksTruncated` (Ars "Read full article" footer, "Continue reading", `[…]` brackets, canonical-URL anchor; negatives for full bodies + inline read-more links)
- `__tests__/utils/share.test.ts` — `xShareUrl` / `threadsShareUrl` / `xQuoteShareUrl` / `threadsQuoteShareUrl` (param shape, encoding, empty/null title, Threads link-only text, curly-quoted passage + link for quote shares)
- `__tests__/utils/readingPosition.test.ts` — `shouldRestorePosition` (3%–95% band), `restoreScrollTop` (fraction → clamped scrollTop), `progressWorthSaving` (1% write threshold)
- `__tests__/components/BottomBar.test.ts` — the four rooms render in order, Found active only on the found route, hidden on reader/login
- `__tests__/components/FeedPickerOverlay.test.ts` — smart-add feed picker: row rendering + source host, add emit, Added/busy states, Cancel↔Done footer, Esc close
- `__tests__/components/SaveArticleOverlay.test.ts` — smart-add article prompt: metadata rendering (optional author/description), save/close emits, saving-guard, Esc close
- `__tests__/components/ShelfPage.test.ts` — the `/shelf` room: listing, swipe-left archive (mark read + unsave, already-read rows skip the redundant mark-read), undo (re-save + positional re-insert, mark-unread only when it was unread), Remove button stays read-state-neutral
- `__tests__/components/FoundPage.test.ts` — Found-feed resolution (empty state + refetch vs. deck scoped to the `kind='found'` feed)
- `__tests__/components/GoodReadsPage.test.ts` — the `/good-reads` room: listing with feed/title/article link, remove (optimistic splice + failure keeps row), empty state
- `__tests__/components/HighlightsPage.test.ts` — the `/highlights` commonplace book: listing with quote/note/article link + SFL badge, hashtag-chip derivation + filter toggle, `renderNoteHtml` note rendering, remove (optimistic splice + failure keeps row), empty state
- `__tests__/components/DiscoverPage.test.ts` — the `/discover` blogroll-graph page: ranked rows with via-line, quiet note only on stale candidates, Add → subscribe POST + toast + `— ADDED` flip (failure keeps row actionable), Dismiss → optimistic removal (failure restores), empty state + "Look now" refresh→refetch
- `__tests__/server/blogroll.test.ts` — Discover's pure blogroll parsers (`server/utils/blogroll.ts`): `parseOpmlOutlines` (nested-category flattening, attr order/quote styles, entity decode, `&nbsp;` tolerance), `isOpml` body sniff, `extractBlogrollLink` rel-token handling, `extractExternalLinks` (origin/platform filtering, footer/nav chrome exclusion, article-link dropping, host dedupe, cap), `candidateHost`/`isPlatformHost`
- `__tests__/server/urlNormalize.test.ts` — `normalizeUrl` for cross-source Found dedup (scheme/www/fragment folding, tracking-param strip, twitter→x.com aliasing, X path-only params, YouTube params preserved, never-collide negatives)
- `__tests__/utils/feedHealth.test.ts` — `feedHealthNote` Sources annotations (failing/paused/quiet states, silence for healthy + push-only kinds, failing-beats-quiet precedence)
- `__tests__/server/searchIndex.test.ts` — `buildFtsQuery` (token quoting, prefix-last, FTS-syntax neutralization, 8-token cap) + `renderSnippetHtml` (sentinel→`<mark>`, escape-before-mark injection safety, client/server sentinel parity)
- `__tests__/server/emailIngest.test.ts` — email→Reader helpers: `stripForwardPrefixes` (chained Fwd/Re/SV/VS), `firstHttpLink` (href-first, bare-URL boundaries + punctuation shed), `emailGuid` (stability, over-long compression), and the email Worker's `senderAuthOk` alignment check (DKIM/SPF/DMARC pass + relaxed alignment, unrelated-domain and suffix-trickery rejections, allow-on-missing-header)
- `__tests__/components/BasicComponent.test.ts` — smoke test for the Vue/Jest toolchain

`~/` and `@/` resolve to repo root (see `jest.config.js` `moduleNameMapper`). **`motion-v` is ESM and is mocked entirely** rather than transformed: `moduleNameMapper` points `motion-v` at `__tests__/mocks/motion-v.ts`, which renders `motion.*` as passthrough divs (cached per tag for stable component identity) and exposes `__setManualAnimations` / `__resolveAnimations` so tests can assert behavior mid-flight. Mock network calls rather than hitting live feeds; Nuxt auto-imported composables don't exist under Jest, so component tests provide them as `globalThis` stubs.

## Architecture

### Tech Stack
- **Frontend**: Nuxt 3 (Vue 3) with auto-imported components and composables
- **Styling**: Tailwind CSS themed by the **Tufte Viz design system** (see "Tufte Viz Design System & Card Deck" below), `@tailwindcss/typography` for reader prose
- **Animation**: `motion-v` (Motion for Vue) — drag physics, springs, and flings on the card deck
- **Backend**: Nitro server routes (REST-style API)
- **Database**: Cloudflare D1 (binding `DB`)
- **Storage**: Cloudflare R2 for article content (binding `ARTICLE_BUCKET`)
- **Auth**: Email/password with PBKDF2 hashing + cookie sessions (zero deps)
- **Feed Parsing**: `@extractus/feed-extractor` for RSS/Atom feeds (NOT rss-parser — that name is historical)
- **Content Sanitization**: isomorphic-dompurify via `utils/processArticleContent.ts`
- **Knowledge pipeline**: swipe-up "elevate" sends an article into the SFL idea tracker (see "Elevate to SFL" below)

### State Management Pattern

This app uses Nuxt's `useState` for global state management instead of Pinia/Vuex. Current composables:

- **`useArticles()`**: Article list, `unreadArticles` computed, `fetchArticles`, `markAsRead`, `markAllAsRead`; plus grid pagination — `total` / `hasMore` / `loadingMore` state and `loadMoreArticles()` (appends the next page of the last list query with the still-matching-count offset from `utils/grid.ts`; the saved-articles path resets `lastQuery`/`hasMore` so the shelf is never paginated)
- **`useViewMode()`**: The deck ↔ grid preference for the reading entrance — `viewMode` (`'deck' | 'grid'`, one global choice for all deck contexts) + `setViewMode`. Persisted in `localStorage['reader:viewMode']`; SSR always sees `'deck'`, so mode-dependent UI must render inside `<ClientOnly>` (DeckScreen does)
- **`useTextSize()`**: Global text-size preference — `textSize` (percent, 80–130 step 10) + `increase`/`decrease`, applied as a root `html { font-size: N% }` so the whole rem-sized UI scales. Persisted in `localStorage['reader:textSize']`; `plugins/text-size.client.ts` touches the composable on every page load so the stored size applies app-wide, not just after visiting Sources (where the A− / A+ header controls live). SSR always sees 100%, so the % readout renders inside `<ClientOnly>`
- **`useFeeds()`**: Feed list, `feedsByTag` grouping (untagged feeds group under `'__inbox__'`), add/delete/sync/tag operations
- **`useSavedArticles()`**: Saved article IDs (a `Set` in `useState`), `saveArticle` / `unsaveArticle` / `isSaved`
- **`useTags()`**: Tag management and counts
- **`useGoodReads()`**: Good-read marks (a `Set` in `useState`) — `isGoodRead` / `markGoodRead` / `unmarkGoodRead` / `toggleGoodRead` (optimistic, revert on error), `seedGoodRead(id, marked)` (the article page seeds one id from its own `isGoodRead` field, no list fetch), `fetchGoodReadIds`
- **`useElevate()`**: `elevate(articleId)` → `{ ideaId, existing }` and `unElevate(articleId, ideaId?, existing?)` — thin client for the elevate endpoints
- **`useHighlights()`**: `fetchHighlights(articleId)`, `createHighlight(articleId, { quote, note, startOffset, endOffset })`, `deleteHighlight(id)` — thin client for the highlight endpoints (see "Highlights → SFL" below)
- **`useToast()`**: Success/error toasts with auto-dismiss (rendered by `AppToast.vue`)
- **`useAuth()`**: Session state, sign-in/out

Each composable returns reactive state and methods. State is shared across all components that call the same composable. (The old `useKeyboardShortcuts`, `useDeckGesture`, and `useSavedArticlesByTag` composables were deleted in the 2026-06 rebuild — keyboard handling now lives in the pages that own it, and drag physics lives in `motion-v` inside `CardStack`.)

Special values that survived the rebuild: `useArticles().fetchArticles(-1)` fetches saved articles, and `useFeeds().feedsByTag` groups untagged feeds under the `'__inbox__'` key (the Sources page renders it as "Inbox").

### Database Schema Key Points

**Feed-Tag Relationship**: Many-to-many through `FeedTag` join table. Feeds can have multiple tags; the Sources room groups feeds by tag.

**Saved Articles ("the shelf")**: Independent `SavedArticle` table (not a boolean on Article) to support:
- User-specific saved state (multi-user ready)
- Tags on saved articles via `SavedArticleTag`
- Future features like notes

**Highlights ("the yellow pen")**: Independent `Highlight` table (migration `005-highlights.sql`) — one row per marked passage, with `quote`, optional `note`, and plain-text `start_offset`/`end_offset` into the rendered article's `textContent`. `sfl_idea_id` holds the SFL `quote` idea it mirrors to (NULL when SFL failed soft). Independent of the shelf (no `SavedArticle` needed) and does not mark the article read. See "Highlights → SFL" below.

**Good reads ("the star", migration `018-good-reads.sql`)**: Independent `GoodRead` table (`user_id, article_id, created_at, UNIQUE(user_id, article_id)`) — like `Highlight`, deliberately independent of the shelf: an article can be a good read without being saved, and unsaving never clears the mark. Written by the star at the end of the reader; listed by `/good-reads`.

**Discover tables** (migration `016-discover.sql`): `DiscoverCandidate` (per-user candidate feeds found in subscriptions' blogrolls; status lifecycle `unresolved → unprobed → candidate` with terminals `dismissed`/`subscribed`/`dead` — terminal rows are **never deleted**, they're the dedupe fence that stops a re-crawl resurrecting them; `UNIQUE(user_id, site_host)`), `DiscoverEdge` (who recommends it — recommender count is the ranking; migration `017` made `feed_id` nullable and added `source`/`label`, so an edge is either one of the user's feeds (blogroll graph) or a labeled external source like `hn-frontpage`/`sfl-saves` — labeled edges have NULL `feed_id`, which the UNIQUE constraint can't dedupe, so the ingest endpoint dedupes them in code), and `DiscoverCrawl` (per-feed crawl bookkeeping for the ≥7-day re-crawl floor). See "Discover (blogroll graph)".

**Cascading Deletes**: All user data cascades on user deletion. Deleting a feed cascades to articles, saved articles, and highlights.

### Component Organization

**Tufte primitives** (`components/tufte/`) — small presentational building blocks every surface composes. Auto-imported with **no path prefix** (configured in `nuxt.config.ts`), so they are `<MonoLabel>`, `<CardFrame>`, etc., NOT `<TufteMonoLabel>`:
- `MonoLabel.vue` - 10px tracked uppercase mono label; `dash` prop adds the leading em-dash (`— SECTION`), `accent` promotes it to the screen's one accent
- `ActionLabel.vue` - **the Tufte substitute for a button**: a bordered mono label, emits `click`; `accent` prop promotes it to the single crimson accent. Use this anywhere a button is needed
- `CardFrame.vue` - hairline-framed raised paper surface (no shadow, no radius) — deck cards, modals, and prompts compose this
- `HairlineRule.vue` - hairline `<hr>` (never boxes); `strong` prop for the heavier rule
- `FeedFavicon.vue` - a feed's tiny favicon (`Feed.favicon_url`, Google S2) beside its name — quiet per-feed differentiation on Sources rows, deck/grid cards, and shelf rows; renders nothing when the URL is missing or fails to load (`size` prop, default 12px)

**Card deck** (`components/stack/`) — the reading entrance:
- `CardStack.vue` - owns the deck state + motion-v physics, performs the five verbs, exposes `commit(direction)`, `undo()`, and `openTop()` to the page
- `ArticleCard.vue` - a single card (`CardFrame`): full-bleed hero with overlaid headline when an image exists, typographic head otherwise; excerpt + reading time
- `DeckEmptyState.vue` - "all caught up" + Sync all
- `UndoToast.vue` - brief `— UNDO <verb>` affordance after save/read/elevate

**Grid survey view** (`components/grid/`) — the deck's scrollable alternate, toggled from the deck header (see "Grid view" under the Tufte section below):
- `ArticleGrid.vue` - vertically scrollable grid — single full-width column on phones (wider rows read + sort easier), 3-col ≥sm — bound to the **live** unread-and-unsaved list. Owns per-card horizontal swipes (`drag="x"` + `touch-action: pan-y` so vertical pans stay native scroll; **one MotionValue per card** (`xFor` map), so a committing card flings out on its own value and the next swipe starts immediately — commits on different cards overlap, only the same card is guarded via the `exiting` set), the commit path (← read / → save, optimistic, `resolveGridDirection` from `utils/grid.ts`), a grid-local LIFO undo history + `UndoToast`, tap→reader with the `movedFar` guard, a bottom **Mark all read** `ActionLabel` (emits `markAllRead`; `markingAll` prop shows the busy label — the parent owns the call), and the IntersectionObserver sentinel that emits `loadMore` (re-observed after each load so a still-visible sentinel fires again). Exposes `undo()` and `commitCard(id, dir)`; **no elevate and no prefetch** (deliberate — see the design notes in the Tufte section)
- `MiniCard.vue` - compact image-led card, responsive to the grid's column count: a horizontal row (fixed `w-28` side thumbnail left, text right) in the 1-col phone grid, stacked (`aspect-[4/3]` hero on top) ≥sm. Thumbnail via `cardImageUrl` (filler filtered) + 3-line headline + `feed · age` mono footer; typographic hairline-head variant when imageless. No excerpt — density is the point

**Shared chrome** (`components/`):
- `DeckScreen.vue` - the entire deck screen (snapshot, keyboard handler, sync, help overlay, and the **deck / grid view toggle**; its `<main>` is `fixed inset-0 overflow-hidden` — the screen contributes no document height, so the page itself never scrolls in deck mode (no iOS rubber-band or URL-bar creep) and grid mode scrolls inside ArticleGrid's own scroller — two mono text-buttons in the header, active word hairline-underlined, mode persisted via `useViewMode()`); optional `tag` prop scopes the deck to one tag and optional `feedId` (+ `title` for the header) scopes it to one feed; emits `not-found` when the tag/feed doesn't exist. In grid mode it mounts `ArticleGrid` on the live filtered list instead of CardStack, forwards `u` to the grid's undo, and leaves arrows/`o`/Enter native (no top card to act on)
- `BottomBar.vue` - fixed bottom room-switcher (Deck / Found / Shelf / Sources); hidden on `/article/*` and `/login`
- `AppToast.vue` - renders `useToast()` state
- `HelpOverlay.vue` - the `?` keyboard-shortcuts card (Teleport + `CardFrame`)
- `TagEditorOverlay.vue` - full-screen tag editor for a feed (Teleport paper sheet — `bg-paper`, no backdrop, no tap-to-dismiss): removable chips + input with autocomplete on existing tags (Enter/comma commit, arrows navigate suggestions, Backspace on empty input removes last chip, Esc cancels via its own window listener). Dumb overlay — takes `feed` + `allTags` props, emits `save(tags)` / `close`; the page owns the API call. Mount with `v-if` so draft state resets per open
- `HighlightNoteOverlay.vue` - full-screen note sheet for a fresh highlight (Teleport paper sheet, mirrors `TagEditorOverlay`): shows the quoted passage + a `<textarea>` for the optional note (`#tags` hint). `#hashtags` light up live as you type — the textarea's text is transparent over a `.note-mirror` div rendering `renderNoteHtml(draft)` (accent + text-shadow fake-bold, since a real weight change would drift the native caret; scroll kept in sync). Takes `quote` + `saving` props, emits `save(note)` / `close`; Cmd/Ctrl+Enter commits, Esc cancels. Mount with `v-if` so the draft resets per open
- `RsvpOverlay.vue` - full-screen RSVP speed-read sheet (Teleport paper sheet, opened from the reader's top action row or `w`): one word at a time with the ORP letter pinned to a fixed x (1fr|auto|1fr grid) as the screen's one accent, hairline progress rail, Slower/Faster/Play–Pause(/Restart)/Close `ActionLabel`s. Takes `words: string[]`, emits `close`; owns its keys while open (space play/pause, ←/→ skip ±10 words, ↑/↓ wpm ±25, Esc close) and tapping the word toggles play. Pure timing/ORP math in `utils/rsvp.ts`; wpm persisted in `localStorage['reader:rsvpWpm']`. Mount with `v-if` so it reopens at word 0
- `HighlightPopover.vue` - small Teleported `CardFrame` near a tapped mark: renders the note via `renderNoteHtml` (hashtags accent-styled) or "No note", a `— IN SFL` `MonoLabel` when synced, **X / Threads share buttons** (brand glyphs; share the marked passage in curly quotes + the article link via `xQuoteShareUrl` / `threadsQuoteShareUrl`, shown only when `sourceUrl` is set), and a **Remove** `ActionLabel`. Takes `highlight` + `x`/`y` (clamped into the viewport) + optional `sourceUrl`, emits `remove` / `close`
- `FeedPickerOverlay.vue` - full-screen picker shown when smart-add discovers **several** feeds at a URL (Teleport paper sheet, mirrors `TagEditorOverlay`): one hairline row per discovered feed (title + mono URL) with an accent Add per row; added rows flip to `— ADDED` so several can be subscribed in one visit; footer reads Cancel before any add, Done after; Esc closes. Dumb overlay — takes `feeds` + `addedUrls` + `busyUrl`, emits `add(feed)` / `close`; the Sources page owns the API calls. Mount with `v-if`
- `SaveArticleOverlay.vue` - full-screen prompt shown when smart-add lands on an article page instead of a feed (Teleport paper sheet): "No feed here" + the extracted title/author/URL/description, Cancel / accent Save-article footer, Esc closes. Dumb overlay — takes `article` + `saving`, emits `save` / `close`; the Sources page POSTs `/api/articles/manual` (which stores it in the "Manual Additions" feed **and saves it to the shelf**). Mount with `v-if`
- `PwaUpdatePrompt.vue` - service-worker update prompt

**Pages** (the three rooms + satellites):
- `pages/index.vue` - thin wrapper — mounts `<DeckScreen />` with no props
- `pages/[tag].vue` - tag-scoped deck (`/TAG-NAME`, ASCII case-insensitive); Tufte not-found state for unknown tags; `BottomBar` shows Deck tab active; Nuxt static routes take precedence so `/shelf` etc. are safe
- `pages/feed/[id].vue` - feed-scoped deck (`/feed/:id`); same `DeckScreen` as the tag deck (passes `feedId` + the feed's `title` for the header), resolves the title from `useFeeds()`, Tufte not-found for an unknown/NaN id; `BottomBar` shows Deck tab active. Each feed title on the Sources page links here
- `pages/article/[id].vue` - the full-screen serif reader (auto-fetches full text for thin RSS bodies). It **keeps your place**: the scroll position is saved server-side as a fraction of scrollable height (`Article.read_progress`, `PATCH /api/articles/:id/progress`) — debounced 1.5s on scroll, flushed on unmount and on `visibilitychange` hidden (the last signal an iOS PWA gets) — and restored on re-entry after the body settles. Pure logic in `utils/readingPosition.ts` (unit-tested): restore only in the 3%–95% band (a barely-started or finished article reopens at the top), skip writes under a 1% delta. Also owns **highlighting**: selecting text shows a floating `— HIGHLIGHT` pill (or press `h`) → `HighlightNoteOverlay` → paints a yellow `<mark>`; tapping a mark opens `HighlightPopover`. On mount (after the body settles) it fetches + paints stored highlights; a `watch(sanitizedContent)` re-anchors them after the one-time full-text re-render. The bottom of the article carries the **good-read star** (`:accent` + filled once marked, key `g`, toggles the `GoodRead` row — see `useGoodReads`) and X / Threads **share** buttons inline beside "Mark as read" (`v-if="article.url"`): non-accent `ActionLabel`s with brand glyphs that open the public web-intent compose URLs built by `utils/share.ts` (`xShareUrl` puts title in `text` + link in `url`; `threadsShareUrl` puts **only** the link in `text` since Threads has no `url` param and renders the bare link as a card — pure + unit-tested) in a new tab. No SDKs, no tracking. Non-accent so the lone crimson stays on "Mark as read"
- `pages/search.vue` - full-text search (`GET /api/search`): autofocused input, 250ms debounce with a sequence guard against out-of-order responses, hairline result rows (feed · date, title, `<mark>`-lit snippet via `renderSnippetHtml`). Reached from the Shelf header ("Search") and the `/` key on the deck (both modes); `search` is in the Sources RESERVED set
- `pages/highlights.vue` - the **commonplace book**: every marked passage across all articles, newest first (`GET /api/highlights`). Each row = the quote under the yellow wash (same `--highlight` pen as `mark.hl`), the note rendered via `renderNoteHtml` (hashtags accent-styled), article link, `In SFL` badge, relative date, Remove. `#hashtag` chips derived from the notes filter the list (one active at a time; the active chip is the screen's accent). Reached from the Shelf header ("Highlights"); `highlights` is in the Sources RESERVED set. Gotcha: in SFC script setup, use `Array.from(set)` not `[...set]` — vue3-jest transpiles SFC scripts with a downlevel target where a Set spread silently yields `[]` under Jest
- `pages/good-reads.vue` - the **good-reads room**: every article starred as a good read, newest first (`GET /api/good-reads`). Hairline rows (feed · starred date, title, excerpt) linking to the reader, per-row Remove (optimistic splice). Reached from the Shelf header ("Good reads"); `good-reads` is in the Sources RESERVED set
- `pages/shelf.vue` - saved articles as hairline rows with a flat tag filter. Each row is **swipe-left = done reading** (same drag mechanics as ArticleGrid: `drag="x"` + `touch-action: pan-y`, per-row MotionValue, `resolveGridDirection`, but only LEFT commits — right has no verb on an already-saved row and springs back): the row flings away, is marked read (only when it wasn't already) **and** unsaved, with a LIFO `UndoToast` that restores both (re-save + re-insert at its old position; mark-unread only if it was unread before). The `— Remove` button stays as the read-state-neutral unsave. A quiet **Continue reading** strip sits above the list (absent when empty): up to 8 unread articles with a saved reading position in the restore band, most recently touched first (`GET /api/articles?inProgress=true`), each row showing feed · progress %
- `pages/discover.vue` - **blogroll-graph discovery**: feeds recommended by the blogs you already read, ranked by how many of your subscriptions link to them (`GET /api/discover`). Each row = candidate title (external link) + mono host, a `via N sources — <feed titles>` line, clamped description, a quiet note when `newestArticleAt` is older than `QUIET_DAYS`, an accent **Add** per row (subscribes via `POST /api/discover/:id/subscribe`, flips to `— ADDED`; busy state is **per-row**, so several slow adds can run concurrently) and a muted **Dismiss** (terminal — never resurrected by the crawl). Empty state carries a "Look now" `ActionLabel` → `POST /api/discover/refresh` (small user-scoped crawl). Reached from the Sources header ("Discover"); `discover` is in the Sources RESERVED set. See "Discover (blogroll graph)" below
- `pages/sources.vue` - add/manage feeds grouped by tag (tag editing via `TagEditorOverlay`), sync all, **A− / A+ text-size controls in the header** (with a % readout; drives `useTextSize()`) beside the feed count (`N` + a small book glyph — no "Sources" title, the BottomBar names the room), per-feed **Sync** row action (`POST /api/feeds/:id/refresh` via `useFeeds().refreshFeed`, toasts the new-article count; hidden for push-only found/manual kinds), account footer. A **Discover** `ActionLabel` button sits at the top of the page body (below the header rule). Each RSS feed row carries a quiet **health note** when something is off (`utils/feedHealth.ts`, pure + unit-tested; silence is the healthy default): "paused after repeated failures" (auto-deactivated at 10 errors), "sync failing (N×)" / "last sync failed" (`lastError` + `errorCount`), or "quiet — last article N ago" when `newestArticleAt` is older than 45 days (`QUIET_DAYS`). Found/manual kinds are never judged. The add form takes any URL — a bare domain works — via `useFeeds().smartAddFeed` (`POST /api/feeds/add-smart`): one feed auto-subscribes, several open `FeedPickerOverlay`, an article page (or feedless-but-titled page) opens `SaveArticleOverlay` to save it as a manual shelf article instead. Below the feed list, a **Linked sources** section (`GET /api/sources/links`; rows with `available:false` — unconfigured OAuth clients — are hidden) connects X / Reddit (OAuth redirect) and Hacker News / GitHub (inline username forms — the shared `isUsernameSource` branch) for the Worker-side Found syncs; OAuth returns land on `/sources?linked=<source>|error=<source>`, toasted + cleaned on mount
- `pages/login.vue`, `pages/mcp-settings.vue`

### API Routes Structure

Routes follow REST conventions:

**Feeds**:
- `GET /api/feeds` - List user's feeds with unread counts, sync-health fields (`lastError`, `errorCount`, `isActive`), and `newestArticleAt` (MAX published_at per feed — powers the Sources health notes)
- `POST /api/feeds` - Add new feed by exact feed URL (409 if already subscribed)
- `POST /api/feeds/discover` - Discover RSS feeds from a URL
- `POST /api/feeds/add-smart` - **The Sources add form's endpoint**: best-effort add from any URL, incl. a bare domain ("vg.no"). Tries the URL as a direct feed, else runs discovery (`server/utils/feedDiscovery.ts`: `<link rel="alternate">` tags resolved against the post-redirect page URL, deduped, entities decoded; falls back to probing common paths — HEAD then GET, stopping at the first hit since the pattern aliases are duplicates of the same feed). Exactly one feed found ⇒ subscribes immediately. Returns a discriminated union: `feed_added` / `feed_exists` / `feeds_discovered` (several feeds — the UI opens `FeedPickerOverlay`) / `article_detected` (an article page, incl. extracted content/description/imageUrl — the UI opens `SaveArticleOverlay`) / `unknown` (title+url suggestion — same overlay, bare). Feed insertion is shared with `POST /api/feeds` via `addFeedForUser()` in `server/utils/addFeed.ts` (initial article import runs through a 5-wide concurrency pool — a serial loop kept subscribe calls waiting tens of seconds); extracted metadata is entity-decoded via `server/utils/htmlEntities.ts` (shared with feedDiscovery)
- `GET /api/feeds/:id` - Single feed
- `DELETE /api/feeds/:id` - Delete feed
- `POST /api/feeds/:id/refresh` - Manually refresh a feed (400 for push-only `found`/`manual` kinds — there is no upstream to fetch)
- `PATCH /api/feeds/:id/tags` - Update feed tags

**Articles**:
- `GET /api/articles` - List articles with filtering (feedId, feedIds, isRead, tag (case-insensitive ASCII; 404 if unknown; empty list if tag has no feeds), `inProgress=true` — unread articles with `read_progress` inside the 3%–95% restore band, ordered by `progress_updated_at` (migration `013`, most recently touched first; the shelf's "Continue reading" strip). Rows include `readProgress`.)
- `GET /api/articles/:id` - Single article with full content
- `PATCH /api/articles/:id/read` - Mark article as read/unread
- `PATCH /api/articles/:id/progress` - Save the reading position `{ progress: 0..1 }` (fraction of scrollable height; clamped server-side)
- `POST /api/articles/mark-all-read` - Bulk mark as read (`{ feedId? | tag? | articleIds? }` — `tag` resolves like the list endpoint: NOCASE match, 404 if unknown, no-feeds tag marks nothing; drives the grid's bottom "Mark all read" via `markAllAsRead(feedId?, tag?)` in `useArticles`)
- `DELETE /api/articles/:id/delete` - Delete article — manual additions and Found cards only; regular RSS articles 400 (the route file is `[id]/delete.delete.ts`; note the `/delete` suffix — there is no bare `DELETE /api/articles/:id`)
- `POST /api/articles/:id/save` - Save article (shelf)
- `DELETE /api/articles/:id/save` - Unsave article
- `POST /api/articles/:id/elevate` - Elevate to SFL (creates a page idea, marks read) — see "Elevate to SFL"
- `DELETE /api/articles/:id/elevate` - Undo an elevate (no body/params — the idea to delete is read from `Article.sfl_idea_id`, set by the elevate; DELETE bodies are dropped by the Workers entry anyway)
- `POST /api/articles/:id/fetch-fulltext` - Fetch + store full article body (RSS often gives only excerpts)
- `POST /api/articles/fetch-fulltext-bulk` - Batch full-text fetch
- `POST /api/articles/manual` - Add a manual (non-RSS) article

**Good reads** (the star at the end of the reader — independent of the shelf, like highlights):
- `GET /api/good-reads` - Every good read the user owns, newest first, joined with article + feed title — powers the `/good-reads` room
- `POST /api/articles/:id/good-read` - Mark the article a good read (`INSERT OR IGNORE` into `GoodRead`; verifies feed ownership)
- `DELETE /api/articles/:id/good-read` - Unmark (id in path, no body). `GET /api/articles/:id` carries `isGoodRead` so the reader renders the star without a second fetch

**Highlights** (see "Highlights → SFL"):
- `GET /api/highlights` - Every highlight the user owns, newest first, joined with article title/url + feed title — powers the `/highlights` room
- `GET /api/articles/:id/highlights` - List the article's highlights (ordered by `start_offset`)
- `POST /api/articles/:id/highlights` - Create a highlight `{ quote, note, startOffset, endOffset }` → SFL `quote` idea + local row + best-effort taste-maker mirror (see "Highlights → taste-maker")
- `DELETE /api/highlights/:id` - Delete a highlight (id in path, no body) + its SFL idea + best-effort taste-maker undo

**Saved Articles**:
- `GET /api/saved-articles` - List user's saved articles (optional tag filter)
- `GET /api/saved-articles/counts` - Saved counts
- `PATCH /api/saved-articles/:id/tags` - Update saved article tags

**Tags**:
- `GET /api/tags` - List user's tags with usage counts
- `POST /api/tags` - Create tag
- `PATCH /api/tags/:id` - Update tag
- `DELETE /api/tags/:id` - Delete tag

**Search**:
- `GET /api/search?q=…` - Full-text search over the user's articles via the `ArticleFts` FTS5 table (migration `014`; title / summary / body text, rowid = Article.id), ranked by bm25 (title weighted 8, summary 3, body 1). Query building (`buildFtsQuery`) quotes every token (FTS syntax can't leak) and prefix-matches the last one. Each hit carries a `snippet` with matches wrapped in private-use-area sentinels (``/``) — the client escapes HTML then swaps them for `<mark>` (`utils/searchRender.ts`, pure + unit-tested). Index maintenance lives in `server/utils/searchIndex.ts` (best-effort — an index failure never fails the article write): written on insert (`insertArticleWithContent`; URL-dedup tombstones skipped), body-refreshed on full-text fetch, replaced on ingest `replace`, and explicitly deleted on article/feed delete (FTS doesn't cascade). Backfill: `POST /api/internal/backfill-search` (Bearer `NUXT_CRON_KEY`, 50/batch with an R2 read each — repeat until `remaining: 0`)

**Discover** (blogroll-graph recommendations — see "Discover (blogroll graph)"):
- `GET /api/discover` - Ready candidates ranked by recommender count (`json_group_array` for via-titles — feed titles can contain any separator), then newest article
- `POST /api/discover/:id/subscribe` - Add the candidate's feed via `addFeedForUser` and mark the row `subscribed`; a feed dead since the probe bumps `attempts` and 422s
- `POST /api/discover/:id/dismiss` - Mark `dismissed` (terminal; the row stays forever as the dedupe fence)
- `POST /api/discover/candidates` - **The source-agnostic ingest seam** (the `/api/ingest` of candidates): external collectors POST `{ source, label?, candidates: [{url, feedUrl?, title?}] }` (≤50; MCP-token auth scopes to the calling user) and the crawl's resolve/probe stages take it from there. Idempotent; existing candidates of any status only gain the labeled edge. Collectors today: `scripts/hn-frontpage-candidates.mjs` (source `hn-frontpage`), `scripts/feed-candidates.mjs` (source `sfl-saves`), and `scripts/ooh-directory-candidates.mjs` (source `ooh-directory`)
- `POST /api/discover/refresh` - Session-authed "Look now": a small crawl scoped to the current user (2 sites / 2 resolves / 3 probes ≈ 32 fetches — sized for ONE invocation's budget); self-limiting via the 7-day floor
- `POST /api/internal/discover-crawl` - Cron entry (Bearer `NUXT_CRON_KEY`, `reader-discover-crawl.timer` every 6h). Body `{ stage: 'crawl'|'resolve'|'probe' }` runs ONE stage per invocation — the Worker's per-invocation fetch budget is **~50 in practice** (free-plan cap; seed runs proved it), so the trigger script POSTs a 5-call sequence (crawl ×1, resolve ×3, probe ×1), each call its own invocation with its own budget. No body ⇒ whole pipeline with tiny batches (hand-testing)

**Sync**:
- `POST /api/sync` - Sync all active feeds for the user

**Read aloud** (see "Read aloud (TTS)"):
- `POST /api/tts` - Synthesize speech for one text chunk `{ text ≤3000 chars }` → `audio/wav`. Session/MCP-authed proxy to the `reader-tts` service on Sleeper; 503 when `NUXT_TTS_API_URL`/`NUXT_TTS_API_KEY` are unset (fails soft, mirrors SFL)

**Ingest** (the "Found" feed — see "Found feed (social bookmarks)"):
- `POST /api/ingest` - Generic, source-agnostic seam. MCP-authed. Body `{ source, externalId, url, title, author?, content?, summary?, imageUrl?, publishedAt?, replace? }` → resolves/creates the user's `kind='found'` feed (via `resolveFoundFeed` in `server/utils/foundFeed.ts`, shared with the X sync) and inserts an unread article (guid = `${source}:${externalId}`, idempotent). Does **not** save or mark read. `replace: true` rebuilds an already-ingested guid in place — metadata + R2 body overwritten, card returned to unread (used by `ai-digest-sync.mjs --replace` to regenerate a day's digest). **Cross-source URL dedup**: a new guid whose normalized URL (`server/utils/urlNormalize.ts`, `Article.url_norm`, migration `012`) already exists in the user's Found feed lands as a **read tombstone** (no body) instead of a second visible card — the guid is still recorded so collectors' "stop once a page isn't all-new" paging stays honest. Same check in the Worker-side `sync-sources` inserts. Backfill for pre-012 rows: `POST /api/internal/backfill-url-norm` (Bearer `NUXT_CRON_KEY`, batched — repeat until `remaining: 0`).

**Email ingest** (forward-to-save via `reader@phareim.no` — full design in [`docs/email-ingest.md`](docs/email-ingest.md)):
- `POST /api/internal/email-ingest` - Bearer `NUXT_EMAIL_INGEST_KEY` (dedicated secret, not the cron key). Called by the standalone **`reader-email` Worker** (`email-worker/` in this repo — Nitro's generated entry can't grow an `email()` handler, so Email Routing delivers to this ~150-line Worker, which parses MIME via `postal-mime`, enforces a 2 MB cap + sender-auth alignment (`email-worker/src/authResults.ts`, pure + unit-tested; missing header ⇒ allow, Cloudflare's edge SPF/DKIM gate already ran), and POSTs here; failures become honest SMTP bounces via `setReject`). The endpoint resolves the **sender's address against `User.email`** (403 ⇒ bounce), caps at 20 email cards/user/day (429), and inserts into the user's Found feed via `insertArticleWithContent` (`source='email'`, guid from Message-ID via `emailGuid` — double-forwards are no-ops; title via `stripForwardPrefixes`; URL = first body link via `firstHttpLink` else filler; HTML part preferred, text `paragraphize`d — helpers in `server/utils/emailIngest.ts`, pure + unit-tested). Worker deploys via `.github/workflows/deploy-email-worker.yml` (path-filtered) or `npx wrangler deploy` from `email-worker/`. **Requires the one-time dashboard step**: Email Routing on the `phareim.no` zone with custom address `reader@phareim.no` → Worker `reader-email`.

**Linked sources** (connect X / Reddit / Hacker News / GitHub on Sources — see "Linked sources (Worker-side)" under the Found feed):
- `GET /api/auth/x/start` / `GET /api/auth/reddit/start` - Begin that provider's OAuth2 dance (browser navigation, not `$fetch`): state (+ PKCE verifier for X; Reddit has no PKCE) in a 10-min cookie, redirect to the authorize page. Session-authed, open to **every** signed-in user — like read-aloud, Petter foots the X bill (~$0.005/post) for guests; Reddit and HN are free
- `GET /api/auth/x/callback` / `GET /api/auth/reddit/callback` - Lands back from the provider: verifies state, exchanges the code, resolves the handle (`users/me` / `/api/v1/me`), upserts the `LinkedSource` row. Always redirects to `/sources?linked=<source>|error=<source>` (never strands the user on JSON)
- `POST /api/sources/links/hackernews` - Link HN by username `{ username }` — favorites are public, so no OAuth: validates the user via the Firebase API and stores the name (NULL credentials)
- `POST /api/sources/links/github` - Link GitHub by username `{ username }` — stars are public, same shape as HN: validates via `GET api.github.com/users/:name`, stores the canonical login (NULL credentials)
- `GET /api/sources/links` - Status for the Sources section: one entry per known source `{ source, available, linked, handle, lastSyncAt, lastError }`; `available:false` (unconfigured OAuth client) hides that row in the UI
- `DELETE /api/sources/links/:source` - Unlink one source: best-effort token revoke upstream (X/Reddit), drop the row. Already-ingested Found articles stay
- `POST /api/internal/sync-sources` - Worker-side sync for **every** `LinkedSource` row (Bearer `NUXT_CRON_KEY`, systemd timer `reader-sources-sync.timer` twice daily), dispatching per source. Shared shape: refresh OAuth credentials near expiry (X and Reddit **rotate** refresh tokens — persisted to D1 immediately; this endpoint is the credentials' only refresher), page newest-first (X 25/page ≤5 pages; Reddit 50/page ≤5; HN 30/page ≤2; GitHub 30/page ≤2), stop once a page isn't all-new (D1 guid check — no local seen-set), render via the pure per-source renderer (`server/utils/{xRender,redditRender,hn,githubStars}.ts`), insert into that user's Found feed. A failing source records `last_error` on its row and never blocks the others (GitHub's unauthenticated API is 60 req/h per Worker-egress IP — a 403 burst just lands in `last_error` and the next run retries)

### Found feed (social bookmarks)

A push-only feed (`Feed.kind='found'`, `is_active=0`) that collects bookmarks/saves from social sources — X bookmarks today, more later. It behaves like any other feed (its unread articles flow into the main Deck and it lists under Sources) **and** has a dedicated **Found** tab in `BottomBar` (`pages/found.vue` → a `DeckScreen` scoped to the Found feed; the five verbs work, so swipe-up elevates a found item straight into SFL→wiki).

- **Reader stays source-agnostic.** Source-specific logic lives in per-source collectors that normalize each item and POST to `/api/ingest` — except X, which is now **in-Worker** (see next bullet). Adding a new source = a new collector, zero Reader changes. `Article.source` records per-item origin (`'x-bookmark'`, `'bluesky'`, `'mastodon'`, `'reddit'`, `'instapaper'`, `'ai-digest'`, `'sleeper-articles'`, …). Six Sleeper-side collectors remain (all Sleeper-only, like `feed-candidates.mjs`); each reads Reader creds from `~/.config/reader/env` (`READER_API_URL` + `READER_MCP_TOKEN`). Four normalize *one social item → one card*; the AI digest reads *many* SFL ideas and synthesizes *one* card; the Sleeper Articles collector mirrors *one already-extracted article → one card*.
- **Linked sources (Worker-side)**: X bookmarks, Reddit saved items, Hacker News favorites, and GitHub stars are **not** Sleeper-side collectors — users connect them from the Sources page ("Linked sources" section) and the Worker syncs them itself. One row per (user, source) in the `LinkedSource` table (migrations `010` → `011`; OAuth token sets live in a `credentials` JSON column, HN + GitHub carry NULL — favorites/stars are public, linked by username only). `POST /api/internal/sync-sources` (Bearer `NUXT_CRON_KEY`, `reader-sources-sync.timer` at 07/19:30) dispatches per source: refresh-if-near-expiry (X **and Reddit rotate refresh tokens** — rotations persist to D1 immediately; the sync endpoint is the credentials' only refresher), page newest-first, stop once a page isn't all-new (D1 guid check: `x-bookmark:<id>` / `reddit:<fullname>` / `hn-favorite:<id>` / `github-star:<repo id>`), render via the pure unit-tested renderers (`server/utils/xRender.ts` — quoted/reply context + native X Articles with the heading heuristic; `server/utils/redditRender.ts` — t3 posts + t1 comments from the raw_json=1 listing, ported from the never-enabled `scripts/reddit-saved-sync.mjs`; `server/utils/hn.ts` — favorites-page id scrape + Firebase item hydration; `server/utils/githubStars.ts` — starred-repo cards from the `star+json` listing, `starred_at` as the card date, owner avatar as the image). Reddit calls all carry the required `User-Agent` (`REDDIT_UA` in `server/utils/redditOauth.ts`); GitHub ones likewise (`GITHUB_UA`). Linking is open to every signed-in user (X bills Petter ~$0.005/post; Reddit + HN + GitHub are free). The old Sleeper-side `scripts/x-bookmark-sync.mjs` + `x-bookmark-sync.timer` are **retired** (script kept for reference). Config: `NUXT_X_CLIENT_ID` + `NUXT_REDDIT_CLIENT_ID` (wrangler `[vars]`) with `NUXT_X_CLIENT_SECRET` + `NUXT_REDDIT_CLIENT_SECRET` (Worker secrets); redirect URIs `https://reader.phareim.no/api/auth/{x,reddit}/callback` must be registered on the respective apps. A missing pair fails soft — that source's row is hidden.
- **Bluesky collector**: `scripts/bluesky-bookmark-sync.mjs`. Lowest-friction — free app password, no OAuth dance, no per-call cost. Opens/refreshes an AT Protocol session (`createSession`/`refreshSession`), pages newest-first through native bookmarks (`app.bsky.bookmark.getBookmarks`), renders each from the hydrated `postView` (text + images + quoted post + link card, no extra fetches), POSTs as `source=bluesky` with `externalId` = the post `at://` URI. Config in `~/.config/bluesky/{env,token.json,state.json}` — `env` holds `BLUESKY_IDENTIFIER`, `BLUESKY_APP_PASSWORD`, optional `BLUESKY_PDS`. Flags: `--dry-run`, `--verbose`, `--max-pages N`.
- **Mastodon collector**: `scripts/mastodon-bookmark-sync.mjs`. Free + friction-light like Bluesky — auth is a personal access token (`read:bookmarks` scope), no OAuth dance. Pages `GET /api/v1/bookmarks` following the `Link: rel="next"` header (Mastodon paginates bookmarks by an internal bookmark id only exposed there, not the status id), renders each Status from the object (HTML content + media + boosted `reblog` + link `card`), POSTs as `source=mastodon` with `externalId` = status id. Config in `~/.config/mastodon/{env,state.json}` — `env` holds `MASTODON_INSTANCE` + `MASTODON_ACCESS_TOKEN`. Flags: `--dry-run`, `--verbose`, `--max-pages N`.
- **Reddit collector**: `scripts/reddit-saved-sync.mjs`. Reddit's analog to bookmarks is the **saved** list (saved posts AND comments). OAuth2 "script" app password grant (mints a fresh ~1h token per run — no refresh bookkeeping), pages `GET /user/{username}/saved` with `raw_json=1` following the `after` cursor, renders `t3` posts (title/selftext/preview image/external link) and `t1` comments (body + thread title) from the listing. POSTs as `source=reddit` with `externalId` = the fullname (`t3_…`/`t1_…`). Requires a unique `User-Agent` (Reddit 429s without one). Config in `~/.config/reddit/{env,state.json}` — `env` holds `REDDIT_CLIENT_ID`, `REDDIT_CLIENT_SECRET`, `REDDIT_USERNAME`, `REDDIT_PASSWORD`, optional `REDDIT_USER_AGENT`. Flags: `--dry-run`, `--verbose`, `--max-pages N`.
- **Instapaper collector**: `scripts/instapaper-sync.mjs`. Natural fit (a save-for-later service). OAuth 1.0a **xAuth** (HMAC-SHA1 signing hand-rolled with `node:crypto`, verified against the `oauth-1.0a` vector), `bookmarks/list` on a folder (default `unread`), best-effort `bookmarks/get_text` for full article bodies, POSTs as `source=instapaper` with `externalId` = `bookmark_id`. Config in `~/.config/instapaper/{env,token.json,state.json}`. **Gated** on a consumer key/secret from Instapaper's human-reviewed [request form](https://www.instapaper.com/main/request_oauth_consumer_token) — throws until present, so the timer is harmless meanwhile. Flags: `--dry-run`, `--verbose`, `--folder NAME`, `--no-text`.
- **AI digest collector**: `scripts/ai-digest-sync.mjs`. The odd one out — reads *many → one*. Pulls the last ~26h of SFL ideas tagged `ai-news` (`GET /api/ideas?tag=ai-news` — reads the **tag**, not the producing job, so the recurring AI-discovery job can evolve underneath it), asks an LLM (**Venice.ai** OpenAI-compatible API, model `zai-org-glm-5-2`, plain `fetch`, no SDK dep) for a calm editor's-letter HTML digest grouped into 2–4 themes with each claim linked to its source, and POSTs **one** card as `source=ai-digest` with `externalId=<YYYY-MM-DD>` (guid `ai-digest:<date>`, idempotent per day). glm reasons before answering, so the call sets `venice_parameters.disable_thinking`+`strip_thinking_response`; `extractFragment()` strips any reasoning preamble/fence. `ai-news` ideas are mostly `type:note` with `url=null` (source link in the body) — `sourceUrl()` recovers it, `unwrapDeadLinks()` strips any `href="#"` the model invents. Empty window → posts nothing; LLM failure → deterministic linked-list fallback. Config in `~/.config/ai-digest/{env,state.json}` — `env` holds `SFL_API_URL`, `SFL_API_KEY`, `VENICE_API_KEY` (falls back to shell `VENICE_API_TOKEN`), optional `DIGEST_MODEL`/`VENICE_API_URL`/`DIGEST_WINDOW_HOURS`. Flags: `--dry-run`, `--verbose`, `--window-hours N`, `--date YYYY-MM-DD`, `--replace` (rebuild an already-posted day in place via the ingest `replace` flag). Design: [`docs/found-feed-ai-digest.md`](docs/found-feed-ai-digest.md).
- **Sleeper Articles collector**: `scripts/sleeper-articles-sync.mjs`. Mirrors the Sleeper Articles service (`~/chat/articles` — the SFL-bookmark extraction pipeline on `127.0.0.1:3003`) into Found. Reads *one already-extracted article → one card*: pages the articles list newest-first (`GET /?status=ready&cursor=…`, cursor pagination via `next_cursor`/`has_more`), stopping once a page is not entirely new (bounded by `--page-size`/`--max-pages`/`--max-items`), then fetches each new item's full doc (`GET /:id` — the list view strips `content_md`) and renders **by kind**: `article`/`digest` bodies via a vendored dependency-free Markdown→HTML converter (`mdToHtml`, since `marked` isn't a Reader dep), `video` as a thumbnail+link card, `post` as an X-style card from `doc.post_data`. POSTs as `source=sleeper-articles` with `externalId=<article id>` (guid `sleeper-articles:<id>`, idempotent). The list/read endpoints are public today, so `ARTICLES_API_KEY` is optional. **The Articles service already holds hundreds of ready items**, so `--seed` marks the current backlog seen without ingesting (run once to establish a baseline — done 2026-07-01, 500 seeded + 3 test cards kept); normal runs then pull only genuinely new articles. Config in `~/.config/sleeper-articles/{env,state.json}` — `env` holds `ARTICLES_API_URL` (default `http://127.0.0.1:3003`) + optional `ARTICLES_API_KEY`. Flags: `--dry-run`, `--verbose`, `--seed`, `--ids a,b,c` (force-ingest exactly these ids, bypassing paging + the seen-set), `--page-size N`, `--max-pages N`, `--max-items N`. **Push-on-ready (2026-07-12):** the Articles service now also triggers this collector itself — on ready-transitions, on `starred: true` PATCHes (the "best content" signal; `--ids` reaches even seeded-out backlog items), and on digest upserts — via `~/chat/articles/src/services/reader-push.ts` (debounced 45s, killswitch `READER_PUSH_ENABLED`); both that spawn and the systemd unit take `flock ~/.config/sleeper-articles/.lock` so runs serialize instead of racing on `state.json`, and the 08/20:20 timer stays as the safety net. Note this partly overlaps upstream sources: these articles originate from SFL bookmarks, and Reader's swipe-up elevate writes *back* to SFL — dedup is by guid, but the same X post can appear both as an `x-bookmark` card and a `sleeper-articles` `post` card.
- **Schedules**: systemd **user** timers (`Persistent=true`, units vendored under `scripts/systemd/`). The Worker-side linked-sources sync (`reader-sources-sync.timer` → `scripts/sync-sources.mjs`) runs at 07/19:30; the remaining Sleeper-side collectors run twice daily staggered (07/19:40·50, 08/20:00·10); the Sleeper Articles collector runs twice daily at 08/20:20; the AI digest runs once at 06:30 (first in Found at breakfast). `journalctl --user -u <name>` to tail; `systemctl --user start <name>.service` to run now.
- **Full reference + native-app integration spec**: [`docs/found-feed.md`](docs/found-feed.md).

### Removed surfaces (2026-06 rebuild)

The AI features were torn out with the UX rebuild: newsletter-style summaries (`/api/articles/summarize`), per-tag summaries (`/api/tags/:name/summary`), the one-shot `/api/claude` endpoint, and the Unsplash fallback image endpoint are all **gone**. `OPENAI_API_KEY` and `ANTHROPIC_API_KEY` are no longer needed, and the Worker has no `AI` binding. Legacy article rows may still carry Unsplash filler image URLs from the old feed parser — `utils/cardData.ts` (`cardImageUrl`) filters them client-side; never show them. (Full-text fetch also replaces filler/missing `image_url` server-side with the page's og:image when it runs — see "Full-text fetching".)

### Elevate to SFL

The swipe-up verb promotes an article into the SFL idea tracker (sfl.hareim.no), which the wider knowledge pipeline (sleeper-articles → thoughts/wiki) polls downstream.

- **Server client**: `server/utils/sfl.ts` — `createPageIdea` / `deleteIdea` against `${NUXT_SFL_API_URL}/api/ideas` with Bearer auth, 10s timeouts, response-shape validation. SFL **dedupes page ideas by URL**: POSTing an existing URL returns `{ existing: true, idea }` instead of creating.
- **Route contract**: `POST /api/articles/:id/elevate` creates the SFL idea, then marks the article read (mirroring `read.patch.ts`) **and records the idea id in `Article.sfl_idea_id` — but only when it created the idea (`!existing`); a pre-existing idea is stored as NULL, since it is not ours to delete**; if the local DB write fails it compensates by deleting the idea it just created (only when `!existing`). Returns `{ success, ideaId, existing }`. `DELETE /api/articles/:id/elevate` takes **no body or params** — it reads `Article.sfl_idea_id` back (scoped to the caller's own article) and deletes that idea, so the delete never trusts a client-supplied id (mirrors `Highlight.sfl_idea_id`; a DELETE body would crash the Worker anyway, as Nitro's cloudflare-module entry only buffers post/put/patch). Present ⇒ ours to delete, so undo needs no `existing` flag. Then marks the article unread and clears the column. (The client's `unElevate` still sends `?ideaId=&existing=` for backward-compat; the server ignores them.)
- **Client semantics**: elevate is **non-optimistic** — `CardStack` holds the card mid-air while SFL answers and springs it back on failure ("Could not reach SFL — card kept"). The deck history entry records `ideaId` + `ideaExisting` so undo can reverse correctly.
- **Config**: `NUXT_SFL_API_URL` (set in `wrangler.toml` `[vars]` for prod, `.env.local` for dev) and `NUXT_SFL_API_KEY` (dev: `.env.local`; prod: `wrangler secret put NUXT_SFL_API_KEY`). When either is missing the endpoints 503 ("SFL is not configured") and the UI fails soft.

### Highlights → SFL

The yellow-pen verb saves a *specific passage* (not the whole article) to SFL as a self-contained `quote` idea. Shares the SFL config above.

- **Anchoring**: a highlight is stored as plain-text `start_offset`/`end_offset` into the rendered article's `textContent` (the processed `sanitizedContent` is deterministic) plus the exact `quote` string. `utils/highlightDom.ts` (pure, jsdom-tested) does the DOM work: `getSelectionOffsets` (selection → offsets), `paintHighlight` (wrap the range in `<mark class="hl" data-hl-id>`, splitting across element boundaries; falls back to `textContent.indexOf(quote)` when offsets drift after the full-text re-render), `unpaint`, `clearHighlights`.
- **Hashtags**: `#words` in the note become **real SFL tags**. `utils/hashtags.ts` (pure, shared client+server): `extractHashtags` (unicode-aware, deduped, lowercased) and `renderNoteHtml` (escape + wrap `#tag` in an accent span for the popover). The `#word` also stays visible in the note text.
- **Server client** (`server/utils/sfl.ts`, alongside the elevate helpers): `createQuoteIdea` posts `{ type:'quote', title:<quote≤120>, summary:note, data:{ text, note, source_url, source_title } }` with **no `url`** (quote dedup is url-scoped; we want many quotes per article). `findOrCreateTag` (GET `/api/tags` match-by-title, else POST a `type:'tag'` idea) + `tagIdea` (POST `/api/connections` `label:'tagged_with'`, swallows the 400 "already exists") mirror the canonical `~/sfl-hook` convention. Both are **best-effort** — a tag failure never fails the highlight.
- **Route contract**: `POST /api/articles/:id/highlights` creates the quote idea, promotes hashtags to tags, then inserts the local `Highlight` row. **Fails soft**: if `getSflConfig` 503s (SFL unconfigured) the mark is still stored locally with `sfl_idea_id = NULL`; any *other* SFL error (network/timeout) is surfaced. `DELETE /api/highlights/:id` (id in path — no DELETE body, per the Workers entry) deletes the local row and the SFL idea when one exists.
- **Client semantics**: **non-optimistic** — the page awaits the server id before painting the mark (`saveHighlight` in `pages/article/[id].vue`). Independent of the shelf and does **not** mark the article read.

### Highlights → taste-maker

Personal-account highlights are ALSO mirrored one-way into **taste-maker** (`taste.phareim.no`, `~/github/taste-maker`) as `quote` items — encounter in Reader, refine there. Runs **after** the local row insert (the row id is the idempotency key `reader-highlight:<id>`; taste-maker dedupes on it, so re-sends are harmless).

- **Server client** (`server/utils/taste.ts`): `createQuoteItem` POSTs `{highlight_id, quote, note, source_url, source_title}` to `/api/ingest/highlight`; `deleteQuoteItem` sends the undo, which taste-maker honors only while the item is untouched (no refine wins/losses, no connections). Unlike the SFL mirror, this is **fully best-effort** — never surfaces an error; `Highlight.taste_item_id` (migration `015`) is NULL on a miss.
- **Backfill/repair**: `node scripts/taste-highlight-backfill.mjs` (from this repo on a wrangler-authed host; `--dry-run`/`--force`) mirrors all rows with NULL `taste_item_id` and writes the ids back. First run 2026-07-14: 11/11.
- **Config**: `NUXT_TASTE_API_URL` (wrangler `[vars]`, `https://taste.phareim.no`) + `NUXT_TASTE_INGEST_KEY` (Worker secret = taste-maker's `TASTE_INGEST_KEY`; host copy in `~/.config/taste/env`). Unset ⇒ the mirror silently skips; everything else works.

### Read aloud (TTS)

The "Listen" button at the top of the reader (`pages/article/[id].vue`, key `l`) speaks the article — NVIDIA's hosted **Magpie TTS Multilingual** voice by default, **OpenAI `gpt-4o-mini-tts`** for Norwegian (Magpie speaks 9 languages, none Scandinavian).

- **Chain**: browser → `POST /api/tts` (Worker, session/MCP auth) → `reader-tts` on Sleeper (Bearer `NUXT_TTS_API_KEY`) → NVIDIA gRPC (`grpc.nvcf.nvidia.com:443`, free-tier NIM) or OpenAI → audio back down (`audio/wav` from Magpie, `audio/mpeg` from OpenAI; the Worker passes the upstream Content-Type through). The Worker can't speak gRPC, hence the Sleeper hop.
- **Language routing** (server-side in `tts/server.py`, per chunk): æ/ø/å in the text, a Norwegian-stopword ratio ≥ 0.15, or an explicit `language_code` of `no/nb/nn/da/sv` → OpenAI (~$0.015/min of audio); everything else → Magpie (free). ä/ö deliberately don't trigger it — they'd misroute German, which Magpie speaks natively. Without `OPENAI_API_KEY` everything falls back to Magpie.
- **`reader-tts` service** (`tts/` in this repo, Sleeper-only like the collectors): Python/Flask + `nvidia-riva-client`, PM2 name `reader-tts`, port 3015, proxied at `sleeper.phareim.no/reader-tts/`. Env at `~/.config/reader-tts/env` (`NVIDIA_API_KEY`, `READER_TTS_KEY`, optional `OPENAI_API_KEY`/`OPENAI_TTS_MODEL`/`OPENAI_TTS_VOICE`, loaded with override semantics). `GET /health` is open (reports `norwegian_backend`); `POST /synthesize` needs the Bearer. See `tts/README.md`.
- **Client semantics**: the body is spoken in sentence-boundary chunks (`chunkTextForTts`, ≤1100 chars) — chunk 0 plays as soon as it lands while chunk 1 prefetches, so time-to-first-word stays a second or two. One reused `<audio>` element keeps iOS's gesture unlock valid across chunks; a `ttsToken` counter invalidates the in-flight session on stop/skip/unmount so a stale `onended` can't restart playback. The chunk text is taken from the **article element's `textContent`** (not `stripHtml`) so `locateChunks` (`utils/tts.ts`) can map each chunk to exact character offsets; failures toast and reset ("Could not reach the reading voice").
- **Player + follow view**: while the voice speaks, a fixed bottom bar carries the controls — Back/Next skip a passage, an accent Pause/Resume, Stop, a `— READING i/n` counter, and a hairline rail filling with char-weighted overall progress (per-chunk fraction via `timeupdate`). The **currently-spoken passage** gets a faint crimson wash in the body (`::highlight(tts-reading)` in `main.css`, `--accent-wash`) painted via the CSS Custom Highlight API over a Range from `rangeForOffsets` (`utils/highlightDom.ts`) — no DOM mutation, so the yellow-pen `<mark>`s are never disturbed; browsers without the API just skip the wash. The view gently auto-scrolls when a new passage's top drifts out of the reading band. The **Media Session API** mirrors play/pause/stop/prev/next onto the lock screen (the iOS PWA case), and the audio element's own `pause`/`play` events keep the state honest when the OS pauses it directly. Keys while active: space pause/resume, ←/→ skip a passage, Esc stops (before it would navigate back); the top button still cycles Listen → Voice… → Stop.
- **Config**: `NUXT_TTS_API_URL` (wrangler `[vars]`, `https://sleeper.phareim.no/reader-tts`) + `NUXT_TTS_API_KEY` (Worker secret = `READER_TTS_KEY` on Sleeper). Unset ⇒ `/api/tts` 503s and the button fails soft; everything else works.

### Discover (blogroll graph)

Second-degree feed discovery: the sites you already subscribe to recommend the next ones. The crawl visits each RSS feed's site (`Feed.site_url`, else the feed URL's origin) looking for a **blogroll** — the explicit `<link rel="blogroll">` convention, the well-known OPML paths (`/.well-known/recommendations.opml`, `/blogroll.opml`), or a human `/blogroll`·`/links` page (body-gated: ≥3 external links, redirect-back-to-homepage rejected — status 200 + content-type prove nothing, SPA catch-alls lie). Each external blog becomes a per-user `DiscoverCandidate` with a `DiscoverEdge` per recommending feed; `/discover` ranks by edge count.

- **Pure parsing** in `server/utils/blogroll.ts` (unit-tested, no fetch): `parseOpmlOutlines` (tag-regex + `decodeEntities`, NOT a strict XML parser — real-world OPML carries `&nbsp;`), `isOpml` body sniff, `extractBlogrollLink`, `extractExternalLinks` (linkedom, off-origin + non-platform hosts only, **page chrome excluded** — footer/nav/header/aside anchors are corporate-network links, not blogroll entries — and **article-style links dropped** (`looksLikeArticleLink`: >2 path segments or a `/20xx/` date; a media site's "/links" page is a wall of cross-network article cards, and dropping them lets the ≥3-links gate reject the page wholesale); deduped by host, capped 30), `PLATFORM_DOMAINS`/`isPlatformHost`, `candidateHost`.
- **Orchestration** in `server/utils/blogrollCrawl.ts` — `runDiscoverCrawl(event, {siteBatch, resolveBatch, probeBatch, userId?})`, three bounded resumable stages: **A** crawl sites stalest-first under a ≥7-day per-site floor (`DiscoverCrawl` stamps found-or-not so no-blogroll sites aren't hammered; OPML ingest capped at 30 outlines/site), **B** resolve site-only candidates to feed URLs via `discoverFeeds(url, {maxProbes: 3})` (the expensive stage — ≤7 fetches per miss instead of ≤21; norm-duplicates fold edges into the older row, already-subscribed URLs go straight to `subscribed`), **C** probe via `parseFeed()` for title/description/`newest_article_at` → `candidate`. 3 failed attempts in B/C ⇒ `dead`. Candidates skip platform domains, the recommending site itself, and hosts the user already subscribes to (feed + site URLs).
- **Statuses**: `unresolved → unprobed → candidate`, terminals `dismissed`/`subscribed`/`dead`. Terminal rows are **kept forever** — they're the fence that stops a re-crawl resurrecting a dismissed blog (existing rows of any status only ever gain edges).
- **More sources** (beyond the blogroll graph): collectors normalize their finds and POST to `POST /api/discover/candidates` — Reader stays source-agnostic, exactly like the Found feed's collector seam. `scripts/hn-frontpage-candidates.mjs` (weekly `reader-hn-candidates.timer`, Mon 07:10): one Algolia HN API call for 30 days of front-page stories → domains with ≥3 appearances (capped 20, big-media/platform hosts excluded) → source `hn-frontpage`, label "Hacker News front page". `scripts/feed-candidates.mjs` (the monthly SFL-saves miner) now also pushes its shortlist (only candidates with a working feed) as source `sfl-saves`, label "Your SFL saves" — `--no-push` opts out; it still never auto-subscribes. `scripts/ooh-directory-candidates.mjs` (weekly `reader-ooh-candidates.timer`, Wed 07:15): mines [ooh.directory](https://ooh.directory) (Phil Gyford's hand-curated ~2,400-blog directory) — a hand-written `TAG_CATEGORIES` map in the script turns the user's feed tags into directory categories, a round-robin cursor covers 3 categories per run, entries quiet >365 days are skipped, and each new blog's "More info" page is scraped for the exact RSS URL so candidates POST **with `feedUrl`** and skip the expensive resolve stage; seen-set + cursor persist in `~/.config/reader/ooh-state.json`; polite scraping (first category page only, ≤20 info pages/run, 400ms delays, honest bot UA). Flags: `--dry-run`, `--verbose`, `--categories a/b,c/d`, `--per-run N`, `--max N`, `--max-age-days N`. Labeled sources render in the via-line just like feed titles (`COALESCE(f.title, e.label)`), and a candidate recommended by both a blogroll and HN ranks `via 2`.
- **Cadence + budget**: `reader-discover-crawl.timer` (every 6h, units in `scripts/systemd/`, trigger `scripts/discover-crawl.mjs`, same `~/.config/reader/env` key as sync-stale). The script POSTs **one stage per call** (crawl, resolve ×3, probe) because the Worker's per-invocation fetch budget is ~50 in practice — a combined run dies with "Too many subrequests" (D1 statements appear not to count). 300s timeout per call: stage B's page fetches honor `FETCH_TIMEOUT` default 30s each, so a slow batch legitimately takes minutes. `runDiscoverCrawl` takes `stages?: DiscoverStage[]` for this.

### Feed-candidate report (Sleeper only)

`node scripts/feed-candidates.mjs` mines the SFL save stream (`~/chat/articles/data/articles.db`) for domains worth subscribing to, weighted by thoughts-wiki provenance folds (`~/thoughts/sync/provenance.json` + raw frontmatter), excludes domains already subscribed (via `GET /api/feeds`), and probes survivors for working RSS/Atom feeds. Reader API auth from `~/.config/reader/env` (`READER_API_URL` + `READER_MCP_TOKEN`). Runs monthly via recurring sleeper-task #73 (`DO-PADDLE-CRISPED-CLASP`, cron `0 8 1 * *`), which posts the shortlist as a task comment — it never auto-subscribes. Since 2026-07-18 it also pushes candidates with a working feed into `/discover` via `POST /api/discover/candidates` (source `sfl-saves`; `--no-push` opts out). Flags: `--json`, `--min-score N` (default 4), `--no-push`.

### Key Patterns

**Authentication**: `getOptionalUser()` is the core auth primitive — it resolves MCP token (via `X-MCP-Token` header) or session cookie, returning `null` if unauthenticated. `getAuthenticatedUser()` wraps it and throws 401. Use `toPublicUser(user)` from `server/utils/auth.ts` to shape user objects for API responses. Password hashing in `server/utils/password.ts` (PBKDF2 via Web Crypto, constant-time comparison), session management in `server/utils/session.ts`, client composable in `composables/useAuth.ts`. Auth API routes: `POST /api/auth/sign-in`, `POST /api/auth/sign-up`, `POST /api/auth/sign-out`, `GET /api/auth/session`.

**Reader as identity provider**: in production the `session_token` cookie is set with `domain: .phareim.no` (`cookieOptions()` in `server/utils/session.ts`; dev stays host-only) so the sibling webapps **do.phareim.no** (`~/github/do-web`) and **write.phareim.no** (`~/github/write-web`) receive it. Those Workers bind the same `reader-service` D1 database and validate the session **read-only** (they never write `session`/`User`; Reader owns the schema and expiry cleanup). Unauthenticated visits there bounce to `reader.phareim.no/login?redirect=<url back>`; `pages/login.vue` validates `?redirect=` (`safeRedirect`: https + `phareim.no`/`*.phareim.no` hostnames, or local `/` paths — anything else falls back to `/`). `destroySession` deletes both the domain-wide and the legacy host-only cookie variants.

**Multi-user hardening (2026-07-09, for sharing with friends):**
- **Sign-up is invite-only**: `POST /api/auth/sign-up` requires `inviteCode` matching the `NUXT_INVITE_CODE` secret (unset ⇒ sign-ups closed, 403). The invite also guards the legacy claim branch (an existing `User` row without `password_hash` gets its password set by the first sign-up with that email — this doubles as the **password-reset flow**: to reset someone, `UPDATE "User" SET password_hash = NULL WHERE email = ?` in D1 and have them "sign up" again with the invite code).
- **Password policy**: `server/utils/passwordPolicy.ts` — ≥12 chars with a letter and a digit, enforced at sign-up only (existing passwords grandfathered).
- **Auth rate limiting**: `server/utils/authRateLimit.ts` + `auth_attempt` table (migration `009-auth-attempts.sql`) — ≥10 failed attempts against one email in 10 min ⇒ 429; cleared on success, GC'd after a day.
- **Personal integrations are allowlisted** (`NUXT_PERSONAL_EMAILS`, checked by `server/utils/personal.ts`): SFL elevate (403 from both elevate routes) and the highlight→SFL mirror (skipped — guest highlights stay local with `sfl_idea_id = NULL`). **Read-aloud is deliberately NOT gated** — Petter foots the TTS bill for guests (session auth still required). `GET /api/auth/session` returns `features: { personal }`; the UI hides Elevate in the reader for guests, and `CardStack` takes `canElevate` (**defaults true via `withDefaults` — Vue casts absent boolean props to false**) and springs the card back with a toast.
- **Background sync**: `POST /api/internal/sync-stale` (Bearer `NUXT_CRON_KEY`) syncs the ≤5 stalest active RSS feeds (>1h old) across ALL users per call; a systemd user timer on Sleeper (`reader-sync-stale.timer`, every 10 min, units in `scripts/systemd/`, trigger script `scripts/sync-stale.mjs`, key in `~/.config/reader/env` `READER_CRON_KEY`) provides the cadence, so nobody needs shift+r.
- **Cold-start UX**: `DeckEmptyState` shows "add your first feed" (→ /sources) when the account has no feeds; `BottomBar` hides the Found tab for accounts without a `kind='found'` feed.

**Database Access**: Use `getD1()` from `~/server/utils/cloudflare` to query data and `getArticleBucket()` for article content (R2). Both read `event.context.cloudflare.env` and throw a 500 if the binding is missing — so they only work inside a request handler with the Cloudflare runtime (i.e. via `npm run dev`/`preview` or deployed, not in a bare Node script). Table names are quoted PascalCase in SQL (`"Feed"`, `"Article"`), and every query is scoped by `user_id`. D1's `.run()` reports insert metadata under `meta` — read ids/changes via `lastRowId()` / `rowsChanged()` from `server/utils/d1Result.ts`, never `result.lastRowId` (always undefined on D1). Worker invocations are capped at 1000 subrequests; storing article content costs ~3 per article, which is why per-sync intake defaults to 100 (`MAX_ARTICLES_PER_FEED` overrides).

**Feed Parsing**: Use `parseFeed()` from `server/utils/feedParser.ts` (wraps `@extractus/feed-extractor`). Feed favicons come from Google's S2 favicon service (`https://www.google.com/s2/favicons?domain=…`) derived from the feed's domain — NOT Unsplash (that fallback was removed). Lead images come from `extractImageUrl()` in `server/utils/feedImage.ts` (pure, unit-tested): image enclosure → media:content/media:thumbnail (incl. inside YouTube's media:group) → itunes:image → first `<img>` in the body. feed-extractor parses XML with fast-xml-parser, so element attributes arrive as `@_url`/`@_type`/`@_href` and repeated elements as arrays — never read the xml2js `$.url` shape.

**Feed Sync**: Use `syncSingleFeed()` from `server/utils/feedSync.ts` for syncing a single feed (shared by both `/api/sync` and `/api/feeds/:id/refresh`).

**Tag Operations**: Use `getOrCreateTag()` from `server/utils/tags.ts` for get-or-create tag pattern (shared by feed tags, saved article tags, and manual article endpoints).

**Toast Messages**: Use `useToast()` composable for success/error messages with auto-dismiss; `AppToast.vue` (mounted in `app.vue`) renders them. Do not use raw refs with setTimeout.

**HTML Sanitization**: Use `processArticleContent()` from `utils/processArticleContent.ts` (DOMPurify allowlist + forcing `target="_blank" rel="noopener noreferrer"` on links) before rendering article HTML — done client-side in `pages/article/[id].vue`. It first runs `looksLikePlainText` / `paragraphize` from `utils/paragraphize.ts` so legacy plain-text R2 blobs render paragraphed. Display-time DOMPurify is the security boundary — there is deliberately no server-side sanitization.

**Full-text fetching**: RSS items frequently carry only an excerpt. `server/utils/fulltext.ts` (`fetchFullText`) fetches the source URL (15s timeout, browser UA), extracts **rich HTML** via `server/utils/extractContent.ts` — Mozilla Readability on a `linkedom/worker` DOM (import the `/worker` entry, NOT bare `linkedom`: it's the Workers-safe ESM build), with a `<base href>` injected so relative URLs resolve against the article URL, lazy `data-src` images promoted, and the old regex pipeline kept as a `paragraphize`d plain-text fallback — and stores the body in R2 via `article-content.ts`. `extractContent.ts` is pure (no D1/R2/h3 imports) so Jest tests it directly (`__tests__/server/extractContent.test.ts`; under Jest, `linkedom/worker` is mapped to the CJS entry in `jest.config.js`). The reader auto-triggers fetch when the stored body is **thin** (under ~1200 visible chars) **or truncated** — `utils/truncation.ts` (`looksTruncated`, pure + unit-tested) detects a feed "read-more" footer (Ars Technica's trailing `<a>Read full article</a>`, FeedBurner's "Continue reading", a `[…]` bracket, or a short trailing anchor pointing back at the article's own URL) so a multi-paragraph excerpt that clears the length gate still upgrades. Neither path fires when `full_text_status` is `failed`, `skipped`, or already `fetched`, or when the article's feed is `kind='found'` (the GET response carries `feedKind`) — Found items are pushed fully rendered by a collector, and fetching their source URL (an X post, say) would only scrape a JS shell; `POST /api/articles/:id/fetch-fulltext` enforces the same guard server-side (marks the row `skipped`), and the bulk endpoint excludes found feeds in SQL. The reader also silently re-fetches once when a stored body is tag-less legacy plain text (unless failed/skipped) to upgrade it to rich HTML. **Extraction never blindly overwrites the stored body**: `acceptExtraction` (in `extractContent.ts`, pure, unit-tested) rejects a result that is still thin (<1200 visible chars) while missing the page's own lead image (Readability latching onto page chrome — xkcd's footer instead of the comic), that trades an image-bearing body for an imageless one, or that carries less visible text than what's already stored; a rejected extraction returns `skipped` and keeps the original (`fetchFullText` reads the existing body via the article's `contentKey`, which both routes now pass). When extraction finds nothing but the page has a lead image and the stored body is empty, the image itself becomes the body (`<p><img></p>` — comics like Oglaf, where the strip *is* the article). Since we already hold the page HTML, `fetchFullText` also backfills the card image (even when the body is rejected): `extractLeadImage` (in `extractContent.ts`, pure, unit-tested) takes og:image / twitter:image from the head (relative URLs resolved, non-http schemes rejected), else the first `<img>` of the extracted content, and the D1 update sets `image_url` only when it is NULL, empty, or legacy Unsplash filler — a real RSS image is never overwritten. `fetchFullText` returns the resulting `imageUrl` (read back after the update) and the `POST /api/articles/:id/fetch-fulltext` response carries it, so a caller can update a card in place without re-fetching the whole article.

**Comic/image-led feeds**: feed-extractor's `normalization` **strips HTML from the entry body**, so feeds without `content:encoded` (xkcd, SMBC, Oglaf — RSS `description` or Atom `content`/`summary` only) used to lose their `<img>` at sync time, leaving a thin text scrap that forced the (hopeless) full-text path. `parseFeed` now captures the raw markup via `getExtraEntryFields` (`descriptionHtml`, with `rawEntryText` handling fast-xml-parser's `{'#text': …}` shape) and prefers it over the normalized description, so a comic card carries its comic straight from the feed.

**Deck prefetch (peek warming)**: `CardStack` watches the card directly *behind* the top one (`deckIds[1]`) and calls `useArticles().prefetchArticle(id)` as the deck shifts. That fires the full-text fetch in the background so, by the time the card is promoted or opened, its og:image has backfilled `imageUrl` (an imageless RSS card gains a picture in the peek) and its body is in R2 (opening is instant). It is deduped (a session `Set` in `useState`) and **gated** — skipped when the card already has a usable image (`cardImageUrl`) or its `fullTextStatus` is already `fetched`/`failed`/`skipped` — so it never spends a round-trip for nothing; hence the list endpoint (`GET /api/articles`) now returns `fullTextStatus` alongside the still-`null` `content`. Best-effort and fire-and-forget: a failure leaves the id in the deduped set (a flaky page isn't hammered on every shuffle) and the reader still fetches on open.

**Optimistic Updates**: Save, mark-read, and skip update local state immediately (elevate deliberately does not — see above). When using `useState` with `Set`, always replace the Set (create a new one) rather than mutating in place, since Vue's reactivity doesn't track Set mutations.

**Date Formatting**: Use `formatRelativeDate()` from `utils/formatDate.ts` for relative time display (e.g., "5 minutes ago"). Do not create local formatDate functions in components.

### Keyboard Shortcuts

There is no global shortcut composable — each page owns its handler (with guards: modifier keys other than shift are ignored, and keys are swallowed when focus is in an input/textarea/contentEditable).

**Deck (`components/DeckScreen.vue`, mounted by `/` and `/TAG-NAME`)** — arrows drive the same `CardStack.commit(direction)` path as swipes:
- `←` - Mark the top card read
- `→` - Save (shelf) the top card
- `↑` - Elevate to SFL
- `↓` - Skip (move card to back of deck)
- `o` / `Enter` - Open the reader for the top card (via `CardStack.openTop()` — the page's deck snapshot goes stale after commits)
- `u` - Undo the last verb
- `?` - Toggle the help overlay (`HelpOverlay.vue`; `Esc` closes it — takes a `mode` prop so the key table matches the active view)
- `shift+r` - Sync all feeds (on a feed-scoped deck — `/feed/:id` — this syncs just that feed when it's a pull feed; the push-only Found feed falls back to sync-all)
- `/` - Open search (both deck and grid modes)

**Grid mode** (same handler, branched on `useViewMode()`): only `u` (forwards to `ArticleGrid.undo()`), `?`, and `shift+r` are handled. Arrows and `o`/`Enter` deliberately do nothing and don't `preventDefault` — ArrowUp/Down scroll the grid natively, and there is no top card for verbs to act on. Verbs on grid cards are horizontal swipes (← read / → save) and tap-to-open.

**Reader (`pages/article/[id].vue`)**:
- `Esc` / `Backspace` - Back (or close the highlight popover when one is open)
- `s` - Save/unsave (shelf)
- `r` - Mark read and go back to where you came from — the same history-back as `Esc`, so a feed- or tag-scoped deck is preserved (also the accent "Mark as read" button at the end of the article)
- `e` - Elevate to SFL
- `v` - Open the original in a new tab
- `g` - Toggle the good-read star (also the star button beside the share buttons at the end of the article)
- `h` - Highlight the current selection (opens the note overlay; no-op without a selection)
- `w` - Speed-read the article (opens `RsvpOverlay`; no-op on an empty body)
- `l` - Listen: read the article aloud (toggles — a second press stops; no-op on an empty body)

While the voice is reading, the page handler drives the player first: space pauses/resumes, `←`/`→` skip a passage back/forward, and `Esc` stops the voice instead of navigating back.

While the RSVP overlay is open it owns its own keys (space play/pause, ←/→ skip, ↑/↓ speed, Esc closes); the page handler defers to it.

While the note overlay is open it owns its own keys (Cmd/Ctrl+Enter saves, Esc cancels); the page handler defers to it.

### Styling Notes

- **Tufte Viz aesthetic throughout** (see the dedicated section below): warm paper / dark paper, ET Book serif body, hairline 1px rules (never card shadows or rounded buttons), exactly **one crimson accent per screen** — during a drag that accent is the pending-verb label. The lone sanctioned exception is the **yellow highlighter** (`--highlight` token in `tufte.css`, `mark.hl` rule in `main.css`): a deliberate *second* mark colour for saved passages — crimson stays reserved for the active verb/pill.
- Dark mode is **system-preference** (`darkMode: 'media'` in `tailwind.config.js`); the dark palette lives in `assets/css/tufte.css` under `@media (prefers-color-scheme: dark)`. There is no manual theme toggle. Prefer the token utilities (`bg-paper`, `bg-paper-raised`, `text-ink`, `text-body`, `text-mute`, `text-accent-ink`, `border-rule`, `font-serif`, `max-w-measure`) over `dark:` variants and never reintroduce `blue-*`, `bg-gray-*`, rounded buttons, or shadows.
- Reader prose uses `@tailwindcss/typography`, restyled in `tailwind.config.js` to ET Book / 65ch / accent links / hairline rules.
- Interactive mono-label buttons should carry a `focus-visible` outline (Tailwind `focus-visible:outline focus-visible:outline-1` or a scoped `:focus-visible { outline: 1px solid var(--tufte-accent); }`).

### Tufte Viz Design System & Card Deck

The entire UX is a ground-up build in the **Tufte Viz design system** (warm paper, ET Book serif, hairline rules, one accent). Build plan: `docs/superpowers/plans/2026-06-09-tufte-reader-rebuild.md`. Canonical system: the `tufte-viz` skill at `~/github/skill-tufte-viz/`.

**Vendoring** (the design system can't be reached at runtime on the deployed Worker):
- `public/tufte/fonts/` — ET Book woff files (roman / italic / bold) + license
- `assets/css/tufte.css` — `@font-face`, the `--tufte-*` base tokens, semantic aliases (`--text-*`, `--surface-*`, `--border-*`), and the dark palette under `@media (prefers-color-scheme: dark)`. Loaded first in `nuxt.config.ts` `css` so `main.css` can override.
- `config/tufte.preset.cjs` — the Tailwind preset (added to `tailwind.config.js` `presets`) exposing the token utilities (`paper`, `ink`, `body`, `mute`, `accent`, `rule`, `measure`, …)
- `app.vue` sets `bg-paper text-ink font-serif` and mounts `BottomBar` + `AppToast` + `PwaUpdatePrompt`

**App icon** (`scripts/gen_icon.py`): the Do/Write/Sleep family mark — a thin serif "R" in ink above the rust rule on aged paper. Forked from `~/github/write/Write/scripts/gen_icon.py`. The family font is American Typewriter Light (macOS-only): on a Mac the script uses it directly; on Sleeper it falls back to the vendored Josefin Slab variable font (`scripts/fonts/`, OFL) at wght=330, matched to the Do icon's stroke weight (min stem ≈1.55% of canvas vs the D's 1.56%). Regenerating writes `public/{pwa-192x192,pwa-512x512,apple-touch-icon,favicon}.png` — full-bleed opaque squares (platforms mask their own corners); needs a venv with `pillow` + `fonttools` (instructions in the script header). The old blue-book `favicon.svg` / `apple-touch-icon.svg` and their `sharp`-based generator are gone.

**Four rooms**, switched by `BottomBar.vue`: the **Deck** (`/`, the card stack of unread articles), the **Found** room (`/found`, social bookmarks — a `DeckScreen` scoped to the Found feed; see "Found feed (social bookmarks)"), the **Shelf** (`/shelf`, saved articles), and **Sources** (`/sources`, feed management + account). The reader (`/article/:id`) and login sit outside the bar. Tag group headers on the Sources page link to `/TAG-NAME`; tag routes show the Deck room active in `BottomBar`.

**The five verbs** — one interaction model on touch and keys, all routed through `CardStack.commit(direction)`:

| Gesture / key | Verb | Implementation |
|---|---|---|
| swipe ← / `←` | **Mark read** | optimistic: fling, advance, `markAsRead(id, true).catch(toast)` |
| swipe → / `→` | **Save** (shelf) | optimistic: fling, advance, `saveArticle().catch(toast)` |
| swipe ↑ / `↑` | **Elevate** to SFL | **non-optimistic**: card holds mid-air awaiting SFL, springs back on failure; on success also marks read |
| swipe ↓ / `↓` | **Skip** | `advance` rotates the id to the back of the deck (no API call) |
| tap / `o` / `Enter` | **Open** the reader | navigate `/article/:id` (non-destructive, card stays) |

`u` / the `— UNDO` toast reverses the last destructive verb: unsave, mark-unread, or un-elevate (which deletes the SFL idea **only** when the elevate created it — `ideaExisting` entries are left alone — then marks unread).

**Physics** (`motion-v` inside `CardStack.vue`): the top card is a `motion.div` with `drag` + `drag-snap-to-origin`; its `x`/`y` are MotionValues and `rotate` is a transform of `x` (max ±9°). All visible cards render through one keyed branch so a promoted card keeps its component instance and springs into place. Tunables live in `utils/deck.ts` `DECK` (distance/velocity thresholds, dominance ratio, spring/fling configs). Commit resolution = distance OR a same-direction flick, dominant axis only (`resolveDirection`). The pending verb fades in as the one accent during the drag.

**Pure logic** (unit-tested, no DOM):
- `utils/deck.ts` — `resolveDirection(dx, dy, vx, vy)`, `advance(deck, action)`, `undo(deck, history)`, `DECK` constants, `DeckHistoryEntry` (carries `ideaId`/`ideaExisting` for elevate)
- `utils/grid.ts` — `resolveGridDirection(dx, dy, vx)` (horizontal commit resolution gated on horizontal-over-vertical dominance — a diagonal release is a scroll, never a commit), `nextPageOffset(articles, savedIds, extraOffset)` (pagination under a shrinking unread window), `dedupeAppend(existing, page)`, `GRID` constants (page size 24, 110px distance threshold, 2.0 dominance ratio, sentinel margin)
- `utils/cardData.ts` — `stripHtml`, `readingTimeMinutes` (220 wpm, null for thin excerpt bodies), `cardImageUrl` (filters legacy Unsplash filler), `excerpt`
- `utils/rsvp.ts` — RSVP speed-reading math: `tokenizeWords`, `orpIndex` (Spritz-style optimal-recognition-point, leading/trailing punctuation aware), `wordDelayMs` (base beat from wpm; sentence ×2.2, clause ×1.5, long-word ×1.3 dwell), `RSVP` constants (wpm 100–800 step 25, default 300)
- `utils/tts.ts` — read-aloud chunking: `chunkTextForTts` (sentence-boundary chunks ≤ `TTS.MAX_CHUNK_CHARS` = 1100; over-long sentences hard-split on word boundaries, mid-word only for unbreakable tokens like URLs), `locateChunks` (maps each chunk back to `{start,end}` offsets in the raw source text through the whitespace normalization — powers the read-aloud follow view), `TTS` constants

**The deck-snapshot pattern** (`components/DeckScreen.vue`): the component passes CardStack a **snapshot** (`deckArticles = [...unreadArticles.value]`), deliberately not the live computed — `markAsRead` optimistically flips `isRead`, which would shrink a computed deck on every right-swipe, retrigger CardStack's refill watcher, and wipe the deck + undo history mid-session. The deck refills only on load, explicit sync, and returning from grid mode (all explicit boundaries); the header's unread count stays live via CardStack's `@count` emit. Anything needing the *current* top card must ask CardStack (e.g. `openTop()`), not the snapshot.

**Grid view** (the deck's scrollable alternate, `components/grid/` + `useViewMode()`): a survey mode — a 1-col list of row-layout `MiniCard`s on phones, a 3-col grid of stacked cards ≥sm — for looking over many articles at once, toggled from the deck header and persisted in localStorage. Deliberate contrasts with the deck:
- **Binds the live list** (`unreadArticles` filtered by `savedArticleIds`), not a snapshot — a consumed card *should* leave a survey view, and undo re-inserts it automatically at its published-order position. The grid keeps its own LIFO undo history (no deck order to restore).
- **Verbs**: horizontal swipe ← read / → save (optimistic, same semantics as the deck; `resolveGridDirection` with the deck's 110px distance/600 velocity thresholds plus a **stricter dominance gate** — horizontal must beat vertical 2:1 (deck is 1.4), since a grid cell shares the surface with the scroller; the pending accent label obeys the same rule), tap opens the reader. **No elevate** (vertical gestures belong to scrolling — elevate stays deck-only) and **no skip** (scrolling past *is* skipping). The gesture split is `drag="x"` + `touch-action: pan-y` per cell, with one shared `x` MotionValue bound to the active cell only.
- **Paged loading**: first page stays `limit: 100` (shared with deck mode — toggling must not hand the deck a thin stack); past that, an IntersectionObserver sentinel loads pages of `GRID.PAGE_SIZE` (24) via `useArticles().loadMoreArticles()`. Because the list is fetched `isRead=false&excludeSaved=true`, marking cards read shifts the server window — the next offset is the **count of fetched rows still matching** (`nextPageOffset`), appended pages are deduped by id, and an all-duplicate page bumps `extraOffset` so the loop terminates. The saved-articles path (`fetchArticles(-1)`) resets `lastQuery`/`hasMore` so the shelf is never paginated.
- **No prefetch** (deliberate): the deck warms exactly one card; a grid shows 6–12 and scrolls, so visibility-driven full-text prefetch would burn external fetches + R2 writes (~3 subrequests each against the Worker's 1000 cap) on cards never opened. Imageless cards degrade to the typographic variant; the reader still fetches on open.
- **Header count** in grid mode: `max(gridArticles.length, total − consumed)` — honest about unfetched pages, live as cards leave.

**Race guards** in `CardStack`: `commit` no-ops while `busy` (an in-flight commit) or `dragging`; `performUndo` no-ops while `busy`; `applyAdvance` verifies the expected top id before mutating. `settleWithin()` races every awaited animation against a 1.2s timeout because motion-dom's `JSAnimation.finished` never resolves when an animation is stopped (e.g. a pointer re-grab) — without it `busy` could wedge forever.

### Environment Variables

No auth-specific env vars required — sessions use the D1 database directly. Copy `.env.example` → `.env.local`.

```bash
# Feed parsing (optional)
FETCH_TIMEOUT=30000
MAX_ARTICLES_PER_FEED=200

# SFL elevate (swipe-up). Fails soft (503 + toast) if unset.
NUXT_SFL_API_URL="https://sfl-api.aiwdm.workers.dev"
NUXT_SFL_API_KEY="..."

# Read aloud (the "Listen" button). Fails soft (503 + toast) if unset.
NUXT_TTS_API_URL="https://sleeper.phareim.no/reader-tts"
NUXT_TTS_API_KEY="..."

# Sign-up gate: required invite code (sign-up is closed while unset)
NUXT_INVITE_CODE="..."

# Personal integrations (SFL elevate, highlight mirror, read-aloud) — comma list
NUXT_PERSONAL_EMAILS="phareim@gmail.com"

# Background sync: Bearer key for POST /api/internal/sync-{stale,sources}
NUXT_CRON_KEY="..."

# Email ingest: Bearer key for POST /api/internal/email-ingest — must equal
# EMAIL_INGEST_KEY on the reader-email Worker (email-worker/). A copy lives
# in ~/.config/reader/env as READER_EMAIL_INGEST_KEY.
NUXT_EMAIL_INGEST_KEY="..."

# Linked sources (Sources page) + Worker-side Found syncs. Each pair fails
# soft (that source's row is hidden) while unset; HN needs no credentials.
# Redirect URIs https://<host>/api/auth/{x,reddit}/callback must be
# registered on the respective apps.
NUXT_X_CLIENT_ID="..."
NUXT_X_CLIENT_SECRET="..."
NUXT_REDDIT_CLIENT_ID="..."
NUXT_REDDIT_CLIENT_SECRET="..."
```

In production, `NUXT_SFL_API_URL`, `NUXT_TTS_API_URL`, `NUXT_PERSONAL_EMAILS`, `NUXT_X_CLIENT_ID`, and `NUXT_REDDIT_CLIENT_ID` are set in `wrangler.toml` `[vars]`; `NUXT_SFL_API_KEY`, `NUXT_TTS_API_KEY`, `NUXT_INVITE_CODE`, `NUXT_CRON_KEY`, `NUXT_X_CLIENT_SECRET`, and `NUXT_REDDIT_CLIENT_SECRET` are Worker secrets (`wrangler secret put …`). The old `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` are no longer used by anything.

### Deployment

Deployed as a Cloudflare Worker (SSR via Nitro `cloudflare-module` preset) at `reader.phareim.no`. Config in `wrangler.toml` — bindings: `DB` (D1 `reader-service`), `ARTICLE_BUCKET` (R2 `reader-articles`). CI in `.github/workflows/deploy.yml` runs `npm run build` then `wrangler deploy` on every push to `main` (needs `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` secrets). Apply schema changes with `wrangler d1 execute reader-service --file=database/d1-schema.sql` (migrations live in `database/migrations/`). **CI does not run migrations** — apply an incremental file to prod yourself with `--remote` (e.g. `wrangler d1 execute reader-service --remote --file=database/migrations/005-highlights.sql`) before/with the deploy. Latest applied: `018-good-reads.sql` (the `GoodRead` table; 2026-07-19).

Two Workers **secrets** must exist: `npx wrangler secret put NUXT_SFL_API_KEY` (the SFL API key, for elevate) and `npx wrangler secret put NUXT_TTS_API_KEY` (the `READER_TTS_KEY` from `~/.config/reader-tts/env` on Sleeper, for read-aloud). The matching URLs (`NUXT_SFL_API_URL`, `NUXT_TTS_API_URL`) ship in `wrangler.toml` `[vars]`. Without a secret, that feature returns 503 and everything else works.

**PWA / service worker** (`@vite-pwa/nuxt` in `nuxt.config.ts`): `registerType: 'prompt'` — a new SW waits until the user taps Reload in `PwaUpdatePrompt.vue` (which is built for prompt mode), so a deploy never yanks the running build's chunks out of the precache mid-session. The precached app shell `'/'` is stamped with a **per-build revision** (`buildRevision` at the top of `nuxt.config.ts`); never set it back to `revision: null` — Workbox then pins the first-ever cached shell forever while each deploy purges the hashed `_nuxt/*` chunks it references, and the app boots a shell pointing at 404'd JS and goes dead (bit us 2026-07-02, felt like "the app is unresponsive"). Workbox tests `runtimeCaching` regexes against the **full URL**, so path-anchored `/^\/api\/…/` patterns silently never match — the API routes use `({ url }) => url.pathname.startsWith(…)` functions instead (NetworkFirst, 5s network timeout, for offline reads). Recovery for a device stuck on a dead shell: open the app once so the fixed SW installs in the background, force-quit, reopen (worst case: Safari → Settings → clear website data for the domain and re-add the PWA).

### Common Development Patterns

**Adding a new composable**: Create in `composables/` directory. Will be auto-imported. Use `useState` for global reactive state.

**Adding a new API route**: Create in `server/api/` following the existing pattern. Use `defineEventHandler`, `getAuthenticatedUser`, and return typed responses.

**Adding a new component**: Create in `components/` or subdirectory. Will be auto-imported (`components/tufte/` without prefix). Use `<script setup>` with TypeScript. Compose the Tufte primitives rather than re-inventing labels/buttons/rules.

**Modifying database schema**:
1. Update `database/d1-schema.sql`
2. Apply via `wrangler d1 execute reader-service --file=database/d1-schema.sql` (add a numbered file under `database/migrations/` for incremental changes)

### Component Communication

Components communicate via:
- **Props** - Parent to child data flow
- **Emits** - Child to parent events (e.g. CardStack's `@sync` / `@count`)
- **Composables** - Shared global state (preferred over prop drilling)
- **`defineExpose`** - The page drives CardStack imperatively (`commit` / `undo` / `openTop`) so keys and gestures share one path

### Testing Feed Discovery

The app can discover feeds from:
- Direct RSS/Atom feed URLs
- Website URLs (looks for `<link>` tags pointing to feeds)
- Returns multiple feeds if found (e.g., multiple RSS versions)

## MCP Server Integration

The project includes a Model Context Protocol (MCP) server that allows Claude Desktop to interact with your RSS reader. This enables conversational access to your feeds, articles, and saved content.

### Architecture

```
Claude Desktop
    ↓ (stdio via MCP protocol)
MCP Server (mcp-server/index.ts)
    ↓ (HTTP + X-MCP-Token header)
Nuxt API (http://localhost:3000/api/*)
    ↓
Database (Cloudflare D1 + R2)
```

The MCP server:
- Runs as a separate Node.js process launched by Claude Desktop
- Communicates via stdin/stdout using the MCP protocol
- Makes authenticated HTTP requests to your Reader API
- Shares TypeScript types with the main app (types/api.ts)

### Available MCP Tools (11 total)

**Read Tools:**
- `list_feeds` - Get all RSS feeds with unread counts and tags
- `get_recent_articles` - Fetch articles with filters (feed, read status, limit)
- `search_articles` - With `q`: ranked full-text search (titles/summaries/bodies, snippets) via `GET /api/search`; without: list articles by feed/read-status criteria
- `get_article` - Get full article content by ID (hits `GET /api/articles/:id`)
- `get_saved_articles` - List saved articles (with optional tag filter)
- `list_tags` - Get all tags with usage counts

**Write Tools:**
- `save_article` - Save an article for later reading
- `unsave_article` - Remove article from saved
- `tag_article` - Add/update tags on saved articles
- `add_article` - Add manual article (not from RSS) with title, URL, and tags
- `delete_article` - Delete an article outright (manual + Found cards only)

### Authentication

The MCP server uses per-user token-based authentication stored in the database:

**Server-side** (`server/utils/auth.ts`):
- `getAuthenticatedUser()` checks for `X-MCP-Token` header first
- Looks up user by token in the database (User.mcpToken field)
- Falls back to session authentication for browser requests
- Both methods return the same authenticated user

**User Setup** (Multi-user support):
1. Navigate to `/mcp-settings` in your Reader web app (must be logged in)
2. Click "Generate Token" to create your personal MCP token
3. Enter the path to your cloned Reader repository
4. Copy the generated Claude Desktop configuration
5. Paste into your `claude_desktop_config.json`
6. Restart Claude Desktop

**Database schema**:
- `User.mcpToken` - Unique token per user (nullable, 64-char hex)
- `User.mcpTokenCreatedAt` - Token creation timestamp

**Claude Desktop config** (`~/Library/Application Support/Claude/claude_desktop_config.json`):
```json
{
  "mcpServers": {
    "the-librarian": {
      "command": "node",
      "args": [
        "/path/to/your/reader/node_modules/.bin/tsx",
        "/path/to/your/reader/mcp-server/index.ts"
      ],
      "env": {
        "READER_API_URL": "https://reader.phareim.no",
        "MCP_TOKEN": "your-personal-token-from-settings-page"
      }
    }
  }
}
```

**Security:**
- Each user has their own unique token
- Tokens can be regenerated or revoked at any time via `/mcp-settings`
- No shared credentials or environment variables needed
- Token identifies the user, eliminating need for MCP_USER_EMAIL

### Running the MCP Server

**Development:**
```bash
npm run mcp  # Runs tsx mcp-server/index.ts
```

**With Claude Desktop:**
1. Configure `claude_desktop_config.json` with correct paths
2. Restart Claude Desktop completely
3. MCP tools appear automatically in Claude

### Usage Examples

Once connected, you can ask Claude:

```
"What are my recent unread articles?"
"Show me articles from TechCrunch"
"Save the article about renewable energy"
"What tags do I have?"
"Add this article to my Reader: [title] [url] and tag it with 'AI'"
"Show me all saved articles tagged with 'machine-learning'"
```

### Special Features

**Manual Article Addition:**
- Articles added via `add_article` are stored in a special "Manual Additions" feed
- This feed is auto-created on first manual article
- Allows Claude to curate content for you from conversations

**Tag Integration:**
- Claude can see all your existing tags via `list_tags`
- Can apply existing tags when adding articles
- Maintains consistency with your organization system

### Files

- `mcp-server/index.ts` - Main MCP server implementation
- `mcp-server/README.md` - Detailed setup and troubleshooting guide
- `mcp-server/claude-desktop-config.json` - Configuration template
- `server/utils/auth.ts` - Dual authentication helper (session + MCP token lookup)
- `server/api/user/mcp-token.post.ts` - Generate/regenerate user MCP token
- `server/api/user/mcp-token.delete.ts` - Revoke user MCP token
- `server/api/user/mcp-config.get.ts` - Get token status and config template
- `server/api/articles/manual.post.ts` - Manual article addition endpoint
- `pages/mcp-settings.vue` - User-facing MCP setup page
- `types/api.ts` - Shared TypeScript types for API responses
