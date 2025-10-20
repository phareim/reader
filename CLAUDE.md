# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A modern, self-hosted RSS feed reader built with Nuxt 3, Vue 3, Prisma, and PostgreSQL. Inspired by Google Reader with features like feed organization with tags, saved articles, keyboard shortcuts, and a clean reading experience.

## Development Commands

```bash
# Start development server (runs on http://localhost:3000 or 3001 if 3000 is taken)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Database migrations (development - creates new migrations)
npm run prisma:migrate

# Deploy migrations (production - applies existing migrations)
npx prisma migrate deploy

# Open Prisma Studio for database inspection
npm run prisma:studio

# Reset database (destroys all data)
npx prisma migrate reset
```

## Architecture

### Tech Stack
- **Frontend**: Nuxt 3 (Vue 3) with auto-imported components and composables
- **Styling**: Tailwind CSS with `@tailwindcss/typography` for article content
- **Backend**: Nitro server routes (REST-style API)
- **Database**: PostgreSQL via Prisma ORM
- **Auth**: sidebase/nuxt-auth (Auth.js) with Google OAuth
- **Feed Parsing**: rss-parser for RSS/Atom feeds
- **Content Sanitization**: isomorphic-dompurify for safe HTML rendering

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
- `MenuHeader.vue` - Header with close button and "Vibe Reader" title (clickable to go to overview)
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

**Authentication**: All API routes use `getServerSession()` to get the authenticated user. Routes should return 401 if no session.

**Prisma Access**: Import from `~/lib/prisma` for database access in server routes.

**Feed Parsing**: Use `parseRSSFeed()` utility to handle RSS/Atom feeds with proper error handling.

**HTML Sanitization**: Use `DOMPurify.sanitize()` on article content before displaying (done client-side in Article.vue).

**Optimistic Updates**: Some actions (like marking as read, saving) update local state immediately before API call for snappy UX.

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

Required in `.env.local`:
```bash
DATABASE_URL="postgresql://..."
AUTH_SECRET="random-secret"
AUTH_ORIGIN="http://localhost:3000"
GOOGLE_CLIENT_ID="..."
GOOGLE_CLIENT_SECRET="..."
```

Optional:
```bash
FETCH_TIMEOUT=30000
MAX_ARTICLES_PER_FEED=200
```

### Common Development Patterns

**Adding a new composable**: Create in `composables/` directory. Will be auto-imported. Use `useState` for global reactive state.

**Adding a new API route**: Create in `server/api/` following the existing pattern. Use `defineEventHandler`, `getServerSession`, and return typed responses.

**Adding a new component**: Create in `components/` or subdirectory. Will be auto-imported. Use `<script setup>` with TypeScript.

**Modifying database schema**:
1. Edit `prisma/schema.prisma`
2. Run `npm run prisma:migrate` to create and apply migration
3. Prisma Client will regenerate automatically

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
