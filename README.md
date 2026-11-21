# The Reader

A calm, self-hosted RSS feed reader inspired by Google Reader, for organizing and curating the web's knowledge. Built with Nuxt 4, Vue 3, and Cloudflare (Workers + D1 + R2). The bundled MCP server keeps the project's first name, The Librarian.

## Features

- ✅ Subscribe to RSS/Atom feeds
- ✅ Clean, distraction-free reading experience
- ✅ Mark articles as read/unread or bulk mark all read
- ✅ Manual feed syncing, plus a background sync of stale feeds (a timer calls `POST /api/internal/sync-stale` every 10 minutes)
- ✅ Filter by feed, tag, or read status
- ✅ Cloudflare D1 for relational data
- ✅ Cloudflare R2 for article content
- ✅ Full-text search over titles, summaries and article bodies
- ✅ HTML sanitization for safe article rendering
- ✅ Fast, lightweight Nuxt 4 frontend
- ✅ Discover — new feeds recommended by the blogs you already read (blogroll/OPML crawl of your subscriptions' sites, ranked by recommender count)

## Quick Start

### Prerequisites

- Node.js 22.x or later
- npm
- Cloudflare account with Workers, D1, and R2

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/phareim/reader.git
   cd reader
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure your environment:
   ```bash
   cp .env.example .env.local
   # Edit .env.local with any optional API keys
   ```

4. Create a D1 database and apply the schema:
   ```bash
   wrangler d1 execute <db-name> --file=database/d1-schema.sql
   ```

5. Start the development server:
   ```bash
   npm run dev
   ```

6. Open http://localhost:3000 in your browser.

### Example Feeds

- **Hacker News**: `https://hnrss.org/frontpage`
- **TechCrunch**: `https://techcrunch.com/feed/`
- **The Verge**: `https://www.theverge.com/rss/index.xml`
- **Daring Fireball**: `https://daringfireball.net/feeds/main`

## Architecture

```
Nuxt 4 (server-rendered on a Cloudflare Worker) ↔ Nitro server routes ↔ Cloudflare D1/R2
```

### Database Schema

See `database/d1-schema.sql` for the full schema. Article content is stored in R2.

## API Endpoints

- `GET /api/feeds` — List feeds with unread counts
- `POST /api/feeds` — Subscribe to a new feed
- `DELETE /api/feeds/:id` — Remove a feed (cascades to articles)
- `POST /api/feeds/:id/refresh` — Refresh a specific feed
- `GET /api/articles` — List articles with filtering
- `PATCH /api/articles/:id/read` — Toggle read status
- `POST /api/articles/mark-all-read` — Bulk mark articles as read
- `POST /api/sync` — Sync all active feeds for the current user

## Tech Stack

| Layer        | Technology                | Purpose                    |
|--------------|---------------------------|----------------------------|
| Frontend     | Nuxt 4 (Vue 3)            | UI & routing               |
| Styling      | Tailwind CSS              | Utility-first styling      |
| State        | Nuxt composables          | Client-side state          |
| Backend      | Nitro server routes       | REST-style API             |
| Database     | Cloudflare D1             | Relational storage         |
| Storage     | Cloudflare R2             | Article content blobs      |
| Auth         | Custom (PBKDF2 + cookies) | Email/password login         |

## Project Structure

```
reader/
  database/
    d1-schema.sql
  server/
    api/
      feeds/
      articles/
      sync/
    utils/
  composables/
  pages/
  types/
  .env.example
```

## Configuration

Optional environment variables in `.env.local`:

```bash
FETCH_TIMEOUT=30000
MAX_ARTICLES_PER_FEED=200
```

The Worker uses no LLM keys. The full list of optional integration variables (SFL, taste-maker, read-aloud, linked sources, email ingest) is in `AGENTS.md`.

No auth-specific env vars needed — authentication uses the D1 database directly; sign-up stays closed until `NUXT_INVITE_CODE` is set.

## Development

Available npm scripts:

```bash
npm run dev          # Start development server
npm run build        # Production build
npm run preview      # Preview production build locally
npm run mcp             # MCP server for Claude Desktop
```

To reset D1 data during development, drop and re-run the SQL from `database/`.

## Phase 1 Features (Current)

- ✅ Add/delete feeds
- ✅ Fetch and display articles
- ✅ Mark articles as read/unread
- ✅ Manual feed syncing
- ✅ Basic UI with Tailwind CSS
- ✅ Cloudflare D1 database + R2 storage
- ✅ HTML sanitization
- ✅ Email/password login

## Phase 2 Roadmap

- ✅  Keyboard shortcuts (j/k navigation)
- [ ] Three-pane Google Reader-style layout
- ✅  Tags for feeds
- ✅  Full-text search
- [ ] OPML import/export
- ✅  Dark mode
- ✅  Automated background sync
- [ ] Mobile-responsive design improvements

## Quality Review Follow-Ups

- [x] Require authentication everywhere sensitive data is returned (`/api/articles/[id].get.ts` and `/api/feeds/[id].get.ts` require a signed-in user and answer 404 for another user’s row).
- [x] Make the feed/article pages truly public or truly private— (private: `middleware/auth.global.ts` 302s signed-out visitors to `/login`; only `/` (doorstep) and `/login` are public) either stop hitting auth-only APIs when logged out or update those APIs to support the anonymous “share” views advertised by the UI.
- [x] Ensure route protection actually runs (use a global middleware or add `middleware: 'auth'` to protected pages; the current `definePageMeta({ auth: true })` flag is inert).
- [x] Use D1 `INSERT OR IGNORE` when storing articles so duplicate GUIDs do not abort the entire batch during feed creation/sync (`insertArticleWithContent`).
- [x] Skip fetching adjacent articles (or expose a readonly public endpoint) when the user is logged out so shared article pages don’t spam 401 errors and lose swipe navigation.
- [ ] Expand the Jest suite to cover key composables/server handlers listed in `collectCoverageFrom` (the auth, SFL, taste-maker, ingest and MCP-read routes are covered in `__tests__/server/routes/`; composables and the remaining handlers are not).

## Contributing

Suggestions and bug reports are welcome. Find me at [X](https://x.com/phareim) on [BlueSky](https://bsky.app/profile/phareim.no).


## Acknowledgments

Inspired by the legendary [Google Reader](https://en.wikipedia.org/wiki/Google_Reader) (RIP 2013).
