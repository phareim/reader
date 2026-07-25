# State model and database schema

How Reader holds state on the client (Nuxt `useState` composables) and on the server
(D1 tables). Cross-cutting — read this before adding a surface that needs new state.

## State management pattern

This app uses Nuxt's `useState` for global state management instead of Pinia/Vuex. Current composables:

- **`useArticles()`**: Article list, `unreadArticles` computed, `fetchArticles`, `markAsRead`, `markAllAsRead`; plus grid pagination — `total` / `hasMore` / `loadingMore` state and `loadMoreArticles()` (appends the next page of the last list query with the still-matching-count offset from `utils/grid.ts`; the saved-articles path resets `lastQuery`/`hasMore` so the shelf is never paginated)
- **`useViewMode()`**: The deck ↔ grid preference for the reading entrance — `viewMode` (`'deck' | 'grid'`, one global choice for all deck contexts) + `setViewMode`. Persisted in `localStorage['reader:viewMode']`; SSR always sees `'deck'`, so mode-dependent UI must render inside `<ClientOnly>` (DeckScreen does)
- **`useTextSize()`**: Global text-size preference — `textSize` (percent, 80–130 step 10) + `increase`/`decrease`, applied as a root `html { font-size: N% }` so the whole rem-sized UI scales. Persisted in `localStorage['reader:textSize']`; `plugins/text-size.client.ts` touches the composable on every page load so the stored size applies app-wide, not just after visiting Sources (where the A− / A+ header controls live). SSR always sees 100%, so the % readout renders inside `<ClientOnly>`
- **`useFeeds()`**: Feed list, `feedsByTag` grouping (untagged feeds group under `'__inbox__'`), add/delete/sync/tag operations
- **`useSavedArticles()`**: Saved article IDs (a `Set` in `useState`), `saveArticle` / `unsaveArticle` / `isSaved`
- **`useTags()`**: Tag management and counts
- **`useGoodReads()`**: Good-read marks (a `Set` in `useState`) — `isGoodRead` / `markGoodRead` / `unmarkGoodRead` / `toggleGoodRead` (optimistic, revert on error), `seedGoodRead(id, marked)` (the article page seeds one id from its own `isGoodRead` field, no list fetch), `fetchGoodReadIds`
- **`useElevate()`**: `elevate(articleId)` → `{ ideaId, existing }` and `unElevate(articleId, ideaId?, existing?)` — thin client for the elevate endpoints
- **`useHighlights()`**: `fetchHighlights(articleId)`, `createHighlight(articleId, { quote, note, startOffset, endOffset })`, `deleteHighlight(id)` — thin client for the highlight endpoints (see [`integrations.md`](integrations.md))
- **`useToast()`**: Success/error toasts with auto-dismiss (rendered by `AppToast.vue`)
- **`useAuth()`**: Session state, sign-in/out

Each composable returns reactive state and methods. State is shared across all components that call the same composable. (The old `useKeyboardShortcuts`, `useDeckGesture`, and `useSavedArticlesByTag` composables were deleted in the 2026-06 rebuild — keyboard handling now lives in the pages that own it, and drag physics lives in `motion-v` inside `CardStack`.)

Special values that survived the rebuild: `useArticles().fetchArticles(-1)` fetches saved articles, and `useFeeds().feedsByTag` groups untagged feeds under the `'__inbox__'` key (the Sources page renders it as "Inbox").

## Database schema key points

**Feed-Tag Relationship**: Many-to-many through `FeedTag` join table. Feeds can have multiple tags; the Sources room groups feeds by tag.

**Saved Articles ("the shelf")**: Independent `SavedArticle` table (not a boolean on Article) to support:
- User-specific saved state (multi-user ready)
- Tags on saved articles via `SavedArticleTag`
- Future features like notes

**Highlights ("the yellow pen")**: Independent `Highlight` table (migration `005-highlights.sql`) — one row per marked passage, with `quote`, optional `note`, and plain-text `start_offset`/`end_offset` into the rendered article's `textContent`. `sfl_idea_id` holds the SFL `quote` idea it mirrors to (NULL when SFL failed soft). Independent of the shelf (no `SavedArticle` needed) and does not mark the article read. See [`integrations.md`](integrations.md).

**Good reads ("the star", migration `018-good-reads.sql`)**: Independent `GoodRead` table (`user_id, article_id, created_at, UNIQUE(user_id, article_id)`) — like `Highlight`, deliberately independent of the shelf: an article can be a good read without being saved, and unsaving never clears the mark. Written by the star at the end of the reader; listed by `/good-reads`.

**Discover tables** (migration `016-discover.sql`): `DiscoverCandidate` (per-user candidate feeds found in subscriptions' blogrolls; status lifecycle `unresolved → unprobed → candidate` with terminals `dismissed`/`subscribed`/`dead` — terminal rows are **never deleted**, they're the dedupe fence that stops a re-crawl resurrecting them; `UNIQUE(user_id, site_host)`), `DiscoverEdge` (who recommends it — recommender count is the ranking; migration `017` made `feed_id` nullable and added `source`/`label`, so an edge is either one of the user's feeds (blogroll graph) or a labeled external source like `hn-frontpage`/`sfl-saves` — labeled edges have NULL `feed_id`, which the UNIQUE constraint can't dedupe, so the ingest endpoint dedupes them in code), and `DiscoverCrawl` (per-feed crawl bookkeeping for the ≥7-day re-crawl floor). See "Discover (blogroll graph)".

**Cascading Deletes**: All user data cascades on user deletion. Deleting a feed cascades to articles, saved articles, and highlights.

Full schema: `database/d1-schema.sql`. Incremental changes are numbered files under
`database/migrations/`, applied by CI before every deploy — see the root `CLAUDE.md`
under "Deployment".
