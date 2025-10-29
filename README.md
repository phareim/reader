# The Librarian

A modern, self-hosted RSS feed reader inspired by Google Reader. Your friendly librarian for organizing and curating the web's knowledge. Built with Nuxt 3, Vue 3, Prisma, and Postgres (Neon-ready).

## Features

- ✅ Subscribe to RSS/Atom feeds
- ✅ Clean, distraction-free reading experience
- ✅ Mark articles as read/unread or bulk mark all read
- ✅ Manual feed syncing with per-user rate limiting
- ✅ Filter by feed, tag, or read status
- ✅ Hosted Postgres database for durable storage
- ✅ HTML sanitization for safe article rendering
- ✅ Fast, lightweight Nuxt 3 frontend

## Quick Start

### Prerequisites

- Node.js 22.x or later
- npm
- A Postgres database (Neon works great)

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
   # Edit .env.local with your DATABASE_URL, AUTH_*, and Google OAuth values
   ```

4. Apply the database schema (runs against Neon/Postgres):
   ```bash
   npx prisma migrate deploy
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
Nuxt 3 SPA ↔ Nitro server routes ↔ Prisma ORM ↔ Postgres (Neon)
```

### Database Schema (Prisma excerpt)

```prisma
model Feed {
  id            Int      @id @default(autoincrement())
  userId        String
  url           String
  title         String
  description   String?
  siteUrl       String?
  faviconUrl    String?
  tags          String   @default("[]")
  lastFetchedAt DateTime?
  lastError     String?
  errorCount    Int      @default(0)
  isActive      Boolean  @default(true)
  articles      Article[]
  user          User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, url])
  @@index([userId])
  @@index([isActive])
}
```

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
| ORM          | Prisma                    | Type-safe database access  |
| Database     | Postgres (Neon or hosted) | Durable storage            |
| Auth         | sidebase/nuxt-auth (Auth.js) | Google OAuth sign-in  |

## Project Structure

```
reader/
  prisma/
    migrations/
    schema.prisma
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
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE"
FETCH_TIMEOUT=30000
MAX_ARTICLES_PER_FEED=200
AUTH_SECRET="your-authjs-secret"
AUTH_ORIGIN="http://localhost:3000"
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"
```

## Development

Available npm scripts:

```bash
npm run dev          # Start development server
npm run build        # Production build
npm run preview      # Preview production build locally
npm run prisma:migrate  # prisma migrate dev (generates migrations)
npm run prisma:studio   # Prisma Studio UI
```

To reset your local database (destroys all data):

```bash
npx prisma migrate reset
```

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

## Contributing

Suggestions and bug reports are welcome. Find me at [X](https://x.com/phareim) on [BlueSky](https://bsky.app/profile/phareim.no).


## Acknowledgments

Inspired by the legendary [Google Reader](https://en.wikipedia.org/wiki/Google_Reader) (RIP 2013).
