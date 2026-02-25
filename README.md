# The Librarian

A modern, self-hosted RSS feed reader inspired by Google Reader. Your friendly librarian for organizing and curating the web's knowledge. Built with Nuxt 3, Vue 3, and Supabase (Postgres + Auth).

## Features

- ✅ Subscribe to RSS/Atom feeds
- ✅ Clean, distraction-free reading experience
- ✅ Mark articles as read/unread or bulk mark all read
- ✅ Manual feed syncing with per-user rate limiting
- ✅ Filter by feed, tag, or read status
- ✅ Hosted Supabase Postgres database for durable storage
- ✅ HTML sanitization for safe article rendering
- ✅ Fast, lightweight Nuxt 3 frontend

## Quick Start

### Prerequisites

- Node.js 22.x or later
- npm
- A Supabase project (Postgres + Auth)

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
   # Edit .env.local with your Supabase URL/keys
   ```

4. Apply the database schema and functions in Supabase:
   - Run `database/supabase-schema.sql` in Supabase SQL Editor
   - Run `database/supabase-functions.sql` in Supabase SQL Editor

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
Nuxt 3 SPA ↔ Nitro server routes ↔ Supabase (Postgres + Auth)
```

### Database Schema

See `database/supabase-schema.sql` for the full schema and `database/supabase-functions.sql` for the RPC helpers.

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
| Frontend     | Nuxt 3 (Vue 3)            | UI & routing               |
| Styling      | Tailwind CSS              | Utility-first styling      |
| State        | Nuxt composables          | Client-side state          |
| Backend      | Nitro server routes       | REST-style API             |
| Database     | Supabase Postgres         | Durable storage            |
| Auth         | Supabase Auth             | Google OAuth sign-in       |

## Project Structure

```
reader/
  database/
    supabase-schema.sql
    supabase-functions.sql
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

Set the following environment variables:

```bash
SUPABASE_URL="https://your-project.supabase.co"
SUPABASE_KEY="your-anon-or-public-key"
SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
AUTH_ORIGIN="http://localhost:3000"
FETCH_TIMEOUT=30000
MAX_ARTICLES_PER_FEED=200
```

## Development

Available npm scripts:

```bash
npm run dev          # Start development server
npm run build        # Production build
npm run preview      # Preview production build locally
npm run mcp             # MCP server for Claude Desktop
```

To reset Supabase data during development, drop and re-run the SQL from `database/`.

## Phase 1 Features (Current)

- ✅ Add/delete feeds
- ✅ Fetch and display articles
- ✅ Mark articles as read/unread
- ✅ Manual feed syncing
- ✅ Basic UI with Tailwind CSS
- ✅ Hosted Postgres database
- ✅ HTML sanitization

## Phase 2 Roadmap

- ✅  Keyboard shortcuts (j/k navigation)
- [ ] Three-pane Google Reader-style layout
- ✅  Tags for feeds
- [ ] Full-text search
- [ ] OPML import/export
- ✅  Dark mode
- [ ] Automated background sync
- [ ] Mobile-responsive design improvements

## Quality Review Follow-Ups

- [ ] Require authentication everywhere sensitive data is returned (lock down `/api/articles/[id].get.ts` and `/api/feeds/[id].get.ts` instead of letting anonymous callers enumerate other users’ content).
- [ ] Add auth + rate limiting to `/api/claude` so the Anthropic API key cannot be abused via the public endpoint.
- [ ] Make the feed/article pages truly public or truly private—either stop hitting auth-only APIs when logged out or update those APIs to support the anonymous “share” views advertised by the UI.
- [ ] Ensure route protection actually runs (use a global middleware or add `middleware: 'auth'` to protected pages; the current `definePageMeta({ auth: true })` flag is inert).
- [ ] Use Supabase insert options (`ignoreDuplicates`/`upsert`) when backfilling articles so duplicate GUIDs do not abort the entire batch during feed creation/sync.
- [ ] Skip fetching adjacent articles (or expose a readonly public endpoint) when the user is logged out so shared article pages don’t spam 401 errors and lose swipe navigation.
- [ ] Cache or otherwise limit Unsplash fallback requests; the current per-article call exhausts the free quota quickly during large syncs.
- [ ] Expand the Jest suite beyond the placeholder tests to cover key composables/server handlers listed in `collectCoverageFrom`.

## Contributing

Suggestions and bug reports are welcome. Find me at [X](https://x.com/phareim) on [BlueSky](https://bsky.app/profile/phareim.no).


## Acknowledgments

Inspired by the legendary [Google Reader](https://en.wikipedia.org/wiki/Google_Reader) (RIP 2013).
