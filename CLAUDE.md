# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A modern, self-hosted RSS feed reader built with Nuxt 3, Vue 3, and Cloudflare (Workers + D1 + R2). Inspired by Google Reader with features like feed organization with tags, saved articles, keyboard shortcuts, and a clean reading experience.

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
npx jest __tests__/utils/swipeCurve.test.ts
npx jest -t "name of test"
```

Tests live in `__tests__/` mirroring the source tree (`__tests__/components`, `__tests__/utils`). `~/` and `@/` resolve to repo root (see `jest.config.js` `moduleNameMapper`). Coverage instinct is broad but the actual suite is sparse — mock network/feed calls rather than hitting live feeds.

## Architecture

### Tech Stack
- **Frontend**: Nuxt 3 (Vue 3) with auto-imported components and composables
- **Styling**: Tailwind CSS with `@tailwindcss/typography` for article content
- **Backend**: Nitro server routes (REST-style API)
- **Database**: Cloudflare D1 (binding `DB`)
- **Storage**: Cloudflare R2 for article content (binding `ARTICLE_BUCKET`)
- **AI**: Three providers, used for different surfaces (see "AI Features" below) — Cloudflare Workers AI (binding `AI`), OpenAI SDK, Anthropic SDK
- **Auth**: Email/password with PBKDF2 hashing + cookie sessions (zero deps)
- **Feed Parsing**: `@extractus/feed-extractor` for RSS/Atom feeds (NOT rss-parser — that name is historical)
- **Content Sanitization**: isomorphic-dompurify for safe HTML rendering; `marked` for Markdown (AI summaries)

### State Management Pattern

This app uses Nuxt's `useState` for global state management instead of Pinia/Vuex. Key composables:

- **`useFeeds()`**: Feed list, selection state (`selectedFeedId`, `selectedTag`), tag organization
- **`useArticles()`**: Article list, read/unread filtering, selection state
- **`useSavedArticles()`**: Saved article IDs, save/unsave operations
- **`useSavedArticlesByTag()`**: Organization of saved articles by tags
- **`useTags()`**: Tag management and counts
- **`useKeyboardShortcuts()`**: Global keyboard navigation (j/k, o, m, r, etc.)

Each composable returns reactive state and methods. State is shared across all components that call the same composable.

### Special Feed/Tag IDs

The app uses special numeric values for `selectedFeedId`:
- `null` = All feeds view
- `-1` = Saved articles view
- `-2` = Overview mode (shows EmptyState with unread counts by tag)
- `> 0` = Specific feed ID

Special tag values:
- `'__inbox__'` = Untagged feeds/articles
- `'__saved_untagged__'` = Saved articles without tags

### Database Schema Key Points

**Feed-Tag Relationship**: Many-to-many through `FeedTag` join table. Feeds can have multiple tags, displayed as collapsible folders in the sidebar.

**Saved Articles**: Independent `SavedArticle` table (not a boolean on Article) to support:
- User-specific saved state (multi-user ready)
- Tags on saved articles via `SavedArticleTag`
- Future features like notes

**Cascading Deletes**: All user data cascades on user deletion. Deleting a feed cascades to articles and saved articles.

### Component Organization

**Menu Components** (`components/menu/`):
- `MenuHeader.vue` - Header with close button and "The Librarian" title (clickable to go to overview)
- `AddFeedSection.vue` - Wraps `FeedUrlInput` component
- `SavedArticlesSection.vue` - Collapsible saved articles with tags
- `FeedsSection.vue` - Main feeds list with tag folders
- `FeedDropdownMenu.vue` - Reusable dropdown for feed actions (mark as read, tags, delete)
- `BottomActions.vue` - Sync all and sign in/out

**Main Components**:
- `HamburgerMenu.vue` - Slide-in menu, assembles menu sections
- `Article.vue` - Single article display with expand/collapse
- `EmptyState.vue` - Shown when no articles or in overview mode (selectedFeedId === -2)
- `FeedUrlInput.vue` - Reusable feed URL input with discover/add buttons (used in menu and EmptyState)
- `PageHeader.vue` - Sticky header showing context (feed/tag name) and current article
- `KeyboardShortcutsHelp.vue` - Help dialog for keyboard shortcuts

### API Routes Structure

Routes follow REST conventions:

**Feeds**:
- `GET /api/feeds` - List user's feeds with unread counts
- `POST /api/feeds` - Add new feed (discovers and fetches initial articles)
- `POST /api/feeds/discover` - Discover RSS feeds from a URL
- `DELETE /api/feeds/:id` - Delete feed
- `POST /api/feeds/:id/refresh` - Manually refresh a feed
- `PATCH /api/feeds/:id/tags` - Update feed tags

**Articles**:
- `GET /api/articles` - List articles with filtering (feedId, feedIds, isRead)
- `PATCH /api/articles/:id/read` - Mark article as read/unread
- `POST /api/articles/mark-all-read` - Bulk mark as read
- `POST /api/articles/:id/save` - Save article
- `DELETE /api/articles/:id/save` - Unsave article
- `POST /api/articles/:id/fetch-fulltext` - Fetch + store full article body (RSS often gives only excerpts)
- `POST /api/articles/fetch-fulltext-bulk` - Batch full-text fetch
- `POST /api/articles/summarize` - AI newsletter-style summary of a feed/tag/saved set (OpenAI)
- `POST /api/articles/manual` - Add a manual (non-RSS) article

**AI / extras**:
- `POST /api/claude` - One-shot Claude (Anthropic Haiku) prompt endpoint
- `POST /api/tags/:name/summary` - AI summary of a tag's articles (Cloudflare Workers AI)
- `POST /api/feeds/add-smart` - Add a feed with smarter discovery
- `GET /api/unsplash/random` - Random Unsplash image (feed/article cover fallback)

**Saved Articles**:
- `GET /api/saved-articles` - List user's saved articles (optional tag filter)
- `PATCH /api/saved-articles/:id/tags` - Update saved article tags

**Tags**:
- `GET /api/tags` - List user's tags with usage counts
- `POST /api/tags` - Create tag
- `PATCH /api/tags/:id` - Update tag
- `DELETE /api/tags/:id` - Delete tag

**Sync**:
- `POST /api/sync` - Sync all active feeds for the user

### Key Patterns

**Authentication**: `getOptionalUser()` is the core auth primitive — it resolves MCP token (via `X-MCP-Token` header) or session cookie, returning `null` if unauthenticated. `getAuthenticatedUser()` wraps it and throws 401. Use `toPublicUser(user)` from `server/utils/auth.ts` to shape user objects for API responses (ensures consistent `{ id, email, name, image }` shape). Password hashing in `server/utils/password.ts` (PBKDF2 via Web Crypto, constant-time comparison), session management in `server/utils/session.ts`, client composable in `composables/useAuth.ts`. Auth API routes: `POST /api/auth/sign-in`, `POST /api/auth/sign-up`, `POST /api/auth/sign-out`, `GET /api/auth/session`.

**Database Access**: Use `getD1()` from `~/server/utils/cloudflare` to query data, `getArticleBucket()` for article content (R2), and `getAI()` for the Workers AI binding. All three read `event.context.cloudflare.env` and throw a 500 if the binding is missing — so they only work inside a request handler with the Cloudflare runtime (i.e. via `npm run dev`/`preview` or deployed, not in a bare Node script). Table names are quoted PascalCase in SQL (`"Feed"`, `"Article"`), and every query is scoped by `user_id`.

**Feed Parsing**: Use `parseRSSFeed()` from `server/utils/feedParser.ts` (wraps `@extractus/feed-extractor`). It falls back to an Unsplash image for the favicon when a feed has none.

**Feed Sync**: Use `syncSingleFeed()` from `server/utils/feedSync.ts` for syncing a single feed (shared by both `/api/sync` and `/api/feeds/:id/refresh`).

**Tag Operations**: Use `getOrCreateTag()` from `server/utils/tags.ts` for get-or-create tag pattern (shared by feed tags, saved article tags, and manual article endpoints).

**Toast Messages**: Use `useToast()` composable for success/error messages with auto-dismiss. All pages use this (do not use raw refs with setTimeout).

**HTML Sanitization**: Use `DOMPurify.sanitize()` on article content before displaying (done client-side in Article.vue).

**Optimistic Updates**: Some actions (like marking as read, saving) update local state immediately before API call for snappy UX. When using `useState` with `Set`, always replace the Set (create a new one) rather than mutating in place, since Vue's reactivity doesn't track Set mutations.

**Date Formatting**: Use `formatRelativeDate()` from `utils/formatDate.ts` for relative time display (e.g., "5 minutes ago"). Do not create local formatDate functions in components.

### AI Features

Three providers are used deliberately — match the surface to the right one:

- **OpenAI** (`OPENAI_API_KEY`) — newsletter-style multi-article summaries (`/api/articles/summarize`, logic in `server/utils/summarization.ts`). Returns Markdown with inline `[title](url)` citations; gracefully degrades with an error message if the key is unset.
- **Cloudflare Workers AI** (`AI` binding, no key) — per-tag summaries (`/api/tags/:name/summary`) via `ai.run('@cf/meta/llama-3.3-70b-instruct-fp8-fast', …)` with a `llama-3.1-8b-instruct` fallback. Free/fast, runs at the edge, no external key.
- **Anthropic** (`ANTHROPIC_API_KEY`) — the general-purpose `/api/claude` endpoint (Haiku 4.5).

**Full-text fetching**: RSS items frequently carry only an excerpt. `server/utils/fulltext.ts` (`fetchFullText`) fetches the source URL (15s timeout, browser UA) and stores the body in R2 via `article-content.ts`. Exposed at `/api/articles/:id/fetch-fulltext` and the bulk variant.

### Keyboard Shortcuts

Implemented in `useKeyboardShortcuts` composable:
- `j/k` - Navigate articles up/down
- `o` - Open/close selected article
- `m` - Mark selected as read
- `shift+a` - Mark all as read
- `s` - Save/unsave article
- `r` - Refresh current feed
- `shift+r` - Refresh all feeds
- `g h` - Go to overview (home)
- `?` - Show keyboard shortcuts help

### Styling Notes

- Dark mode supported via Tailwind's `dark:` classes
- Article content uses `@tailwindcss/typography` prose classes
- Text sizes increased to `text-base` (16px) throughout menu for better readability
- Transitions use Vue's `<Transition>` component with custom CSS classes

### Environment Variables

No auth-specific env vars required — sessions use the D1 database directly. Copy `.env.example` → `.env.local`. AI features each fail soft if their key is missing.

```bash
# AI providers (each optional; the corresponding feature degrades if unset)
OPENAI_API_KEY="..."       # article/newsletter summaries
ANTHROPIC_API_KEY="..."    # /api/claude (Haiku)
# (Cloudflare Workers AI uses the `AI` binding, not an env var)

# Feed parsing (optional)
FETCH_TIMEOUT=30000
MAX_ARTICLES_PER_FEED=200
```

### Deployment

Deployed as a Cloudflare Worker (SSR via Nitro `cloudflare-pages`/Workers) at `reader.phareim.no`. Config in `wrangler.toml` — bindings: `DB` (D1 `reader-service`), `ARTICLE_BUCKET` (R2 `reader-articles`), `AI` (Workers AI). CI in `.github/workflows/deploy.yml` runs `npm run build` then `wrangler deploy` on every push to `main` (needs `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` secrets). Apply schema changes with `wrangler d1 execute reader-service --file=database/d1-schema.sql` (migrations live in `database/migrations/`).

### Common Development Patterns

**Adding a new composable**: Create in `composables/` directory. Will be auto-imported. Use `useState` for global reactive state.

**Adding a new API route**: Create in `server/api/` following the existing pattern. Use `defineEventHandler`, `getAuthenticatedUser`, and return typed responses.

**Adding a new component**: Create in `components/` or subdirectory. Will be auto-imported. Use `<script setup>` with TypeScript.

**Modifying database schema**:
1. Update `database/d1-schema.sql`
2. Apply via `wrangler d1 execute reader-service --file=database/d1-schema.sql` (add a numbered file under `database/migrations/` for incremental changes)

### Component Communication

Components communicate via:
- **Props** - Parent to child data flow
- **Emits** - Child to parent events
- **Composables** - Shared global state (preferred over prop drilling)
- **Watchers** - React to state changes (e.g., watching `selectedFeedId` to fetch articles)

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
