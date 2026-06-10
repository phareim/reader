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
- `__tests__/utils/cardData.test.ts` — card derivations (`stripHtml`, `readingTimeMinutes`, `cardImageUrl`, `excerpt`)
- `__tests__/components/CardStack.test.ts` — commit/undo wiring, race guards, elevate failure paths
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

- **`useArticles()`**: Article list, `unreadArticles` computed, `fetchArticles`, `markAsRead`, `markAllAsRead`
- **`useFeeds()`**: Feed list, `feedsByTag` grouping (untagged feeds group under `'__inbox__'`), add/delete/sync/tag operations
- **`useSavedArticles()`**: Saved article IDs (a `Set` in `useState`), `saveArticle` / `unsaveArticle` / `isSaved`
- **`useTags()`**: Tag management and counts
- **`useElevate()`**: `elevate(articleId)` → `{ ideaId, existing }` and `unElevate(articleId, ideaId?, existing?)` — thin client for the elevate endpoints
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

**Cascading Deletes**: All user data cascades on user deletion. Deleting a feed cascades to articles and saved articles.

### Component Organization

**Tufte primitives** (`components/tufte/`) — small presentational building blocks every surface composes. Auto-imported with **no path prefix** (configured in `nuxt.config.ts`), so they are `<MonoLabel>`, `<CardFrame>`, etc., NOT `<TufteMonoLabel>`:
- `MonoLabel.vue` - 10px tracked uppercase mono label; `dash` prop adds the leading em-dash (`— SECTION`), `accent` promotes it to the screen's one accent
- `ActionLabel.vue` - **the Tufte substitute for a button**: a bordered mono label, emits `click`; `accent` prop promotes it to the single crimson accent. Use this anywhere a button is needed
- `CardFrame.vue` - hairline-framed raised paper surface (no shadow, no radius) — deck cards, modals, and prompts compose this
- `HairlineRule.vue` - hairline `<hr>` (never boxes); `strong` prop for the heavier rule

**Card deck** (`components/stack/`) — the reading entrance:
- `CardStack.vue` - owns the deck state + motion-v physics, performs the five verbs, exposes `commit(direction)`, `undo()`, and `openTop()` to the page
- `ArticleCard.vue` - a single card (`CardFrame`): full-bleed hero with overlaid headline when an image exists, typographic head otherwise; excerpt + reading time
- `DeckEmptyState.vue` - "all caught up" + Sync all
- `UndoToast.vue` - brief `— UNDO <verb>` affordance after save/read/elevate

**Shared chrome** (`components/`):
- `DeckScreen.vue` - the entire deck screen (snapshot, keyboard handler, sync, help overlay); optional `tag` prop scopes the deck to one tag; emits `not-found` when tag doesn't exist
- `BottomBar.vue` - fixed bottom room-switcher (Deck / Shelf / Sources); hidden on `/article/*` and `/login`
- `AppToast.vue` - renders `useToast()` state
- `HelpOverlay.vue` - the `?` keyboard-shortcuts card (Teleport + `CardFrame`)
- `PwaUpdatePrompt.vue` - service-worker update prompt

**Pages** (the three rooms + satellites):
- `pages/index.vue` - thin wrapper — mounts `<DeckScreen />` with no props
- `pages/[tag].vue` - tag-scoped deck (`/TAG-NAME`, ASCII case-insensitive); Tufte not-found state for unknown tags; `BottomBar` shows Deck tab active; Nuxt static routes take precedence so `/shelf` etc. are safe
- `pages/article/[id].vue` - the full-screen serif reader (auto-fetches full text for thin RSS bodies)
- `pages/shelf.vue` - saved articles as hairline rows with a flat tag filter
- `pages/sources.vue` - add/manage feeds grouped by tag, sync all, account footer
- `pages/login.vue`, `pages/mcp-settings.vue`

### API Routes Structure

Routes follow REST conventions:

**Feeds**:
- `GET /api/feeds` - List user's feeds with unread counts
- `POST /api/feeds` - Add new feed (discovers and fetches initial articles)
- `POST /api/feeds/discover` - Discover RSS feeds from a URL
- `POST /api/feeds/add-smart` - Add a feed with smarter discovery
- `GET /api/feeds/:id` - Single feed
- `DELETE /api/feeds/:id` - Delete feed
- `POST /api/feeds/:id/refresh` - Manually refresh a feed
- `PATCH /api/feeds/:id/tags` - Update feed tags

**Articles**:
- `GET /api/articles` - List articles with filtering (feedId, feedIds, isRead, tag (case-insensitive ASCII; 404 if unknown; empty list if tag has no feeds))
- `GET /api/articles/:id` - Single article with full content
- `PATCH /api/articles/:id/read` - Mark article as read/unread
- `POST /api/articles/mark-all-read` - Bulk mark as read
- `DELETE /api/articles/:id` - Delete article
- `POST /api/articles/:id/save` - Save article (shelf)
- `DELETE /api/articles/:id/save` - Unsave article
- `POST /api/articles/:id/elevate` - Elevate to SFL (creates a page idea, marks read) — see "Elevate to SFL"
- `DELETE /api/articles/:id/elevate` - Undo an elevate (body `{ ideaId?, existing? }`)
- `POST /api/articles/:id/fetch-fulltext` - Fetch + store full article body (RSS often gives only excerpts)
- `POST /api/articles/fetch-fulltext-bulk` - Batch full-text fetch
- `POST /api/articles/manual` - Add a manual (non-RSS) article

**Saved Articles**:
- `GET /api/saved-articles` - List user's saved articles (optional tag filter)
- `GET /api/saved-articles/counts` - Saved counts
- `PATCH /api/saved-articles/:id/tags` - Update saved article tags

**Tags**:
- `GET /api/tags` - List user's tags with usage counts
- `POST /api/tags` - Create tag
- `PATCH /api/tags/:id` - Update tag
- `DELETE /api/tags/:id` - Delete tag

**Sync**:
- `POST /api/sync` - Sync all active feeds for the user

### Removed surfaces (2026-06 rebuild)

The AI features were torn out with the UX rebuild: newsletter-style summaries (`/api/articles/summarize`), per-tag summaries (`/api/tags/:name/summary`), the one-shot `/api/claude` endpoint, and the Unsplash fallback image endpoint are all **gone**. `OPENAI_API_KEY` and `ANTHROPIC_API_KEY` are no longer needed, and the Worker has no `AI` binding. Legacy article rows may still carry Unsplash filler image URLs from the old feed parser — `utils/cardData.ts` (`cardImageUrl`) filters them client-side; never show them.

### Elevate to SFL

The swipe-up verb promotes an article into the SFL idea tracker (sfl.hareim.no), which the wider knowledge pipeline (sleeper-articles → thoughts/wiki) polls downstream.

- **Server client**: `server/utils/sfl.ts` — `createPageIdea` / `deleteIdea` against `${NUXT_SFL_API_URL}/api/ideas` with Bearer auth, 10s timeouts, response-shape validation. SFL **dedupes page ideas by URL**: POSTing an existing URL returns `{ existing: true, idea }` instead of creating.
- **Route contract**: `POST /api/articles/:id/elevate` creates the SFL idea, then marks the article read (mirroring `read.patch.ts`); if the local DB write fails it compensates by deleting the idea it just created (only when `!existing`). Returns `{ success, ideaId, existing }`. `DELETE /api/articles/:id/elevate` takes `{ ideaId?, existing? }` and deletes the idea **only when it was created by the elevate** (`existing` ideas predate us and are not ours to delete), then marks the article unread.
- **Client semantics**: elevate is **non-optimistic** — `CardStack` holds the card mid-air while SFL answers and springs it back on failure ("Could not reach SFL — card kept"). The deck history entry records `ideaId` + `ideaExisting` so undo can reverse correctly.
- **Config**: `NUXT_SFL_API_URL` (set in `wrangler.toml` `[vars]` for prod, `.env.local` for dev) and `NUXT_SFL_API_KEY` (dev: `.env.local`; prod: `wrangler secret put NUXT_SFL_API_KEY`). When either is missing the endpoints 503 ("SFL is not configured") and the UI fails soft.

### Key Patterns

**Authentication**: `getOptionalUser()` is the core auth primitive — it resolves MCP token (via `X-MCP-Token` header) or session cookie, returning `null` if unauthenticated. `getAuthenticatedUser()` wraps it and throws 401. Use `toPublicUser(user)` from `server/utils/auth.ts` to shape user objects for API responses. Password hashing in `server/utils/password.ts` (PBKDF2 via Web Crypto, constant-time comparison), session management in `server/utils/session.ts`, client composable in `composables/useAuth.ts`. Auth API routes: `POST /api/auth/sign-in`, `POST /api/auth/sign-up`, `POST /api/auth/sign-out`, `GET /api/auth/session`.

**Database Access**: Use `getD1()` from `~/server/utils/cloudflare` to query data and `getArticleBucket()` for article content (R2). Both read `event.context.cloudflare.env` and throw a 500 if the binding is missing — so they only work inside a request handler with the Cloudflare runtime (i.e. via `npm run dev`/`preview` or deployed, not in a bare Node script). Table names are quoted PascalCase in SQL (`"Feed"`, `"Article"`), and every query is scoped by `user_id`.

**Feed Parsing**: Use `parseRSSFeed()` from `server/utils/feedParser.ts` (wraps `@extractus/feed-extractor`). Feed favicons come from Google's S2 favicon service (`https://www.google.com/s2/favicons?domain=…`) derived from the feed's domain — NOT Unsplash (that fallback was removed).

**Feed Sync**: Use `syncSingleFeed()` from `server/utils/feedSync.ts` for syncing a single feed (shared by both `/api/sync` and `/api/feeds/:id/refresh`).

**Tag Operations**: Use `getOrCreateTag()` from `server/utils/tags.ts` for get-or-create tag pattern (shared by feed tags, saved article tags, and manual article endpoints).

**Toast Messages**: Use `useToast()` composable for success/error messages with auto-dismiss; `AppToast.vue` (mounted in `app.vue`) renders them. Do not use raw refs with setTimeout.

**HTML Sanitization**: Use `processArticleContent()` from `utils/processArticleContent.ts` (DOMPurify allowlist + forcing `target="_blank" rel="noopener noreferrer"` on links) before rendering article HTML — done client-side in `pages/article/[id].vue`.

**Full-text fetching**: RSS items frequently carry only an excerpt. `server/utils/fulltext.ts` (`fetchFullText`) fetches the source URL (15s timeout, browser UA) and stores the body in R2 via `article-content.ts`. The reader auto-triggers it when the stored body is under ~1200 visible chars.

**Optimistic Updates**: Save, mark-read, and skip update local state immediately (elevate deliberately does not — see above). When using `useState` with `Set`, always replace the Set (create a new one) rather than mutating in place, since Vue's reactivity doesn't track Set mutations.

**Date Formatting**: Use `formatRelativeDate()` from `utils/formatDate.ts` for relative time display (e.g., "5 minutes ago"). Do not create local formatDate functions in components.

### Keyboard Shortcuts

There is no global shortcut composable — each page owns its handler (with guards: modifier keys other than shift are ignored, and keys are swallowed when focus is in an input/textarea/contentEditable).

**Deck (`components/DeckScreen.vue`, mounted by `/` and `/TAG-NAME`)** — arrows drive the same `CardStack.commit(direction)` path as swipes:
- `←` - Save (shelf) the top card
- `→` - Mark the top card read
- `↑` - Elevate to SFL
- `↓` - Skip (move card to back of deck)
- `o` / `Enter` - Open the reader for the top card (via `CardStack.openTop()` — the page's deck snapshot goes stale after commits)
- `u` - Undo the last verb
- `?` - Toggle the help overlay (`HelpOverlay.vue`; `Esc` closes it)
- `shift+r` - Sync all feeds

**Reader (`pages/article/[id].vue`)**:
- `Esc` / `Backspace` - Back
- `s` - Save/unsave (shelf)
- `e` - Elevate to SFL
- `v` - Open the original in a new tab

### Styling Notes

- **Tufte Viz aesthetic throughout** (see the dedicated section below): warm paper / dark paper, ET Book serif body, hairline 1px rules (never card shadows or rounded buttons), exactly **one crimson accent per screen** — during a drag that accent is the pending-verb label.
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

**Three rooms**, switched by `BottomBar.vue`: the **Deck** (`/`, the card stack of unread articles), the **Shelf** (`/shelf`, saved articles), and **Sources** (`/sources`, feed management + account). The reader (`/article/:id`) and login sit outside the bar. Tag group headers on the Sources page link to `/TAG-NAME`; tag routes show the Deck room active in `BottomBar`.

**The five verbs** — one interaction model on touch and keys, all routed through `CardStack.commit(direction)`:

| Gesture / key | Verb | Implementation |
|---|---|---|
| swipe ← / `←` | **Save** (shelf) | optimistic: fling, advance, `saveArticle().catch(toast)` |
| swipe → / `→` | **Mark read** | optimistic: fling, advance, `markAsRead(id, true).catch(toast)` |
| swipe ↑ / `↑` | **Elevate** to SFL | **non-optimistic**: card holds mid-air awaiting SFL, springs back on failure; on success also marks read |
| swipe ↓ / `↓` | **Skip** | `advance` rotates the id to the back of the deck (no API call) |
| tap / `o` / `Enter` | **Open** the reader | navigate `/article/:id` (non-destructive, card stays) |

`u` / the `— UNDO` toast reverses the last destructive verb: unsave, mark-unread, or un-elevate (which deletes the SFL idea **only** when the elevate created it — `ideaExisting` entries are left alone — then marks unread).

**Physics** (`motion-v` inside `CardStack.vue`): the top card is a `motion.div` with `drag` + `drag-snap-to-origin`; its `x`/`y` are MotionValues and `rotate` is a transform of `x` (max ±9°). All visible cards render through one keyed branch so a promoted card keeps its component instance and springs into place. Tunables live in `utils/deck.ts` `DECK` (distance/velocity thresholds, dominance ratio, spring/fling configs). Commit resolution = distance OR a same-direction flick, dominant axis only (`resolveDirection`). The pending verb fades in as the one accent during the drag.

**Pure logic** (unit-tested, no DOM):
- `utils/deck.ts` — `resolveDirection(dx, dy, vx, vy)`, `advance(deck, action)`, `undo(deck, history)`, `DECK` constants, `DeckHistoryEntry` (carries `ideaId`/`ideaExisting` for elevate)
- `utils/cardData.ts` — `stripHtml`, `readingTimeMinutes` (220 wpm, null for thin excerpt bodies), `cardImageUrl` (filters legacy Unsplash filler), `excerpt`

**The deck-snapshot pattern** (`components/DeckScreen.vue`): the component passes CardStack a **snapshot** (`deckArticles = [...unreadArticles.value]`), deliberately not the live computed — `markAsRead` optimistically flips `isRead`, which would shrink a computed deck on every right-swipe, retrigger CardStack's refill watcher, and wipe the deck + undo history mid-session. The deck refills only on load and explicit sync; the header's unread count stays live via CardStack's `@count` emit. Anything needing the *current* top card must ask CardStack (e.g. `openTop()`), not the snapshot.

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
```

In production, `NUXT_SFL_API_URL` is set in `wrangler.toml` `[vars]`; `NUXT_SFL_API_KEY` is a Worker secret (`wrangler secret put NUXT_SFL_API_KEY`). The old `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` are no longer used by anything.

### Deployment

Deployed as a Cloudflare Worker (SSR via Nitro `cloudflare-module` preset) at `reader.phareim.no`. Config in `wrangler.toml` — bindings: `DB` (D1 `reader-service`), `ARTICLE_BUCKET` (R2 `reader-articles`). CI in `.github/workflows/deploy.yml` runs `npm run build` then `wrangler deploy` on every push to `main` (needs `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` secrets). Apply schema changes with `wrangler d1 execute reader-service --file=database/d1-schema.sql` (migrations live in `database/migrations/`).

One Workers **secret** must exist for the elevate feature: `npx wrangler secret put NUXT_SFL_API_KEY` (the SFL API key; `NUXT_SFL_API_URL` ships in `wrangler.toml` `[vars]`). Without it, elevate returns 503 and everything else works.

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

### Available MCP Tools (10 total)

**Read Tools:**
- `list_feeds` - Get all RSS feeds with unread counts and tags
- `get_recent_articles` - Fetch articles with filters (feed, read status, limit)
- `search_articles` - Search articles by criteria
- `get_article` - Get full article content by ID
- `get_saved_articles` - List saved articles (with optional tag filter)
- `list_tags` - Get all tags with usage counts

**Write Tools:**
- `save_article` - Save an article for later reading
- `unsave_article` - Remove article from saved
- `tag_article` - Add/update tags on saved articles
- `add_article` - Add manual article (not from RSS) with title, URL, and tags

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
