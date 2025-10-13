# Phase 1: MVP Implementation Plan - Google Reader Clone

## Overview
Build a functional RSS feed reader with core reading and organization features. Focus on getting a working product that can fetch, display, and track articles from RSS feeds.

**⚠️ Important Constraints for Phase 1:**
- Feed sync is **manual only** (user-triggered) - automated background polling deferred to Phase 2
- Feed URLs must be **exact RSS/Atom URLs** - feed discovery from website URLs deferred to Phase 2
- **Offset-based pagination** accepted for MVP (cursor-based optimization in Phase 2)
- **No automated tests** in Phase 1 (manual testing only)

---

## 1. Project Setup & Infrastructure

### 1.1 Initialize Project Structure
**Goal**: Set up a clean Nuxt 3 project with proper architecture

**Tasks**:
- [ ] Clear existing `.nuxt` directory and reinitialize Nuxt 3
- [ ] Install core dependencies:
  - `nuxt` (v3.x)
  - `@nuxtjs/tailwindcss` for styling
  - `rss-parser` for RSS/Atom parsing
  - `prisma` and `@prisma/client` for database (✅ **Decision: Using Prisma ORM**)
  - `isomorphic-dompurify` for HTML sanitization (✅ **Security requirement**)
  - `date-fns` for date formatting
  - `@vueuse/core` for composables
- [ ] Set up TypeScript configuration
- [ ] Create `.env` file with configuration

**Directory Structure**:
```
reader/
├── server/
│   ├── api/
│   │   ├── feeds/
│   │   │   ├── index.get.ts          # Get all feeds
│   │   │   ├── index.post.ts         # Add new feed
│   │   │   ├── [id].delete.ts        # Remove feed
│   │   │   └── [id]/refresh.post.ts  # Manually refresh feed
│   │   ├── articles/
│   │   │   ├── index.get.ts          # Get articles (with filters)
│   │   │   ├── [id]/read.patch.ts    # Mark as read/unread
│   │   │   └── mark-all-read.post.ts # Mark all as read
│   │   └── sync/
│   │       └── index.post.ts         # Sync all feeds
│   ├── db/
│   │   ├── schema.ts                 # Database schema
│   │   ├── migrations/               # DB migrations
│   │   └── index.ts                  # DB connection
│   └── utils/
│       ├── feedParser.ts             # RSS parsing logic
│       └── feedFetcher.ts            # HTTP fetching with error handling
├── components/
│   ├── layout/
│   │   ├── Sidebar.vue               # Left sidebar with feeds
│   │   ├── ArticleList.vue           # Middle pane with articles
│   │   └── ArticleView.vue           # Right pane with content
│   ├── feed/
│   │   ├── FeedItem.vue              # Single feed in sidebar
│   │   ├── AddFeedDialog.vue         # Modal to add feed
│   │   └── FeedUnreadBadge.vue       # Unread count badge
│   └── article/
│       ├── ArticleListItem.vue       # Article in list
│       └── ArticleContent.vue        # Full article display
├── composables/
│   ├── useFeeds.ts                   # Feed management logic
│   ├── useArticles.ts                # Article management logic
│   └── useKeyboard.ts                # Keyboard shortcuts
├── pages/
│   └── index.vue                     # Main reader interface
└── types/
    └── index.ts                      # TypeScript types
```

**Deliverables**:
- Clean project with no errors on `npm run dev`
- All directories created
- Dependencies installed and configured

---

## 2. Database Schema & Setup

### 2.1 Define Database Schema (Prisma)
**Goal**: Create a normalized database schema to store feeds and articles using Prisma

**Schema Design** (`prisma/schema.prisma`):

```prisma
datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

model Feed {
  id              Int       @id @default(autoincrement())
  url             String    @unique
  title           String
  description     String?
  siteUrl         String?
  faviconUrl      String?
  lastFetchedAt   DateTime?
  lastError       String?
  errorCount      Int       @default(0)
  fetchInterval   Int       @default(900)
  isActive        Boolean   @default(true)
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  articles        Article[]

  @@index([isActive])
}

model Article {
  id            Int       @id @default(autoincrement())
  feedId        Int
  guid          String
  title         String
  url           String
  author        String?
  content       String?
  summary       String?
  publishedAt   DateTime?
  isRead        Boolean   @default(false)
  isStarred     Boolean   @default(false)
  readAt        DateTime?
  createdAt     DateTime  @default(now())

  feed          Feed      @relation(fields: [feedId], references: [id], onDelete: Cascade)

  @@unique([feedId, guid])
  @@index([feedId, isRead])
  @@index([publishedAt(sort: Desc)])
}
```

**Key Improvements**:
- ✅ Added `errorCount` field to track consecutive failures
- ✅ Added `@@index` for performance on common queries
- ✅ Using Prisma's type-safe client
- ✅ Automatic migrations with `prisma migrate`

**Environment Configuration** (`.env`):
```
DATABASE_URL="file:./data/reader.db"
FETCH_TIMEOUT=30000
MAX_ARTICLES_PER_FEED=500
```

**Tasks**:
- [ ] Create `prisma/schema.prisma` file
- [ ] Run `npx prisma migrate dev --name init`
- [ ] Generate Prisma client
- [ ] Create database initialization function

**Deliverables**:
- Working database with schema
- Helper functions for common queries
- Seed data for development

---

## 3. Backend API Development

### 3.1 Feed Parser Service
**Goal**: Robust RSS/Atom feed parsing with error handling

**File**: `server/utils/feedParser.ts`

**Features**:
- Parse RSS 2.0, RSS 1.0, and Atom feeds using `rss-parser`
- Extract: title, description, link, guid, pubDate, author, content
- Handle malformed feeds gracefully
- Normalize dates to UTC ISO format
- ✅ **Sanitize HTML content with `isomorphic-dompurify`** (security critical)

**GUID Generation Strategy** (✅ Improved duplicate detection):
```typescript
// Fallback logic for missing/broken GUIDs
guid = item.guid || item.link || hash(item.title + item.pubDate)
```

**Favicon Strategy** (✅ Simple MVP approach):
```typescript
// Use Google's favicon service
faviconUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=32`
```

**Error Handling**:
- Network timeouts (30s max from env)
- Invalid XML/malformed feeds
- Missing required fields (title, link)
- HTTP errors (404, 500, etc.)
- Increment `errorCount` on failure, disable feed after 10 consecutive failures

**Tasks**:
- [ ] Create `parseFeed(url: string)` function
- [ ] Implement GUID fallback logic
- [ ] Add HTML sanitization with DOMPurify
- [ ] Normalize dates to UTC
- [ ] Add comprehensive error handling
- [ ] Extract and set favicon URL

### 3.2 Feed Management API
**Goal**: CRUD operations for feeds

**Endpoints**:

#### `GET /api/feeds`
Returns all feeds with unread counts
```typescript
Response: {
  feeds: Array<{
    id: number
    title: string
    url: string
    siteUrl: string
    faviconUrl: string
    unreadCount: number
    lastFetchedAt: string
    isActive: boolean
  }>
}
```

#### `POST /api/feeds`
Add a new feed subscription
```typescript
Request: {
  url: string  // ⚠️ Must be exact RSS/Atom feed URL (not website URL)
}
Response: {
  feed: Feed
  articlesAdded: number
}
```

**Logic**:
1. Validate URL format (must be valid RSS/Atom feed)
2. Fetch and parse feed
3. Extract favicon using Google's service
4. Insert feed into database
5. Fetch initial articles (limit from env: MAX_ARTICLES_PER_FEED)
6. Return feed details

**Note**: Feed discovery from website URLs deferred to Phase 2

#### `DELETE /api/feeds/:id`
Remove a feed and all its articles
```typescript
Response: {
  success: boolean
  deletedArticles: number
}
```

#### `POST /api/feeds/:id/refresh`
Manually refresh a specific feed
```typescript
Response: {
  success: boolean
  newArticles: number
  error?: string
}
```

**Tasks**:
- [ ] Implement all endpoints
- [ ] Add request validation
- [ ] Add error responses with proper HTTP codes
- [ ] Test with real RSS feeds

### 3.3 Article Management API
**Goal**: Retrieve and update articles

**Endpoints**:

#### `GET /api/articles`
Get articles with filtering
```typescript
Query params:
  feedId?: number      // Filter by feed
  isRead?: boolean     // Filter by read status
  isStarred?: boolean  // Filter by starred
  limit?: number       // Pagination (default 50)
  offset?: number      // Pagination (default 0)

Response: {
  articles: Array<Article>
  total: number
  hasMore: boolean
}
```

#### `PATCH /api/articles/:id/read`
Mark article as read/unread
```typescript
Request: {
  isRead: boolean
}
Response: {
  success: boolean
}
```

#### `POST /api/articles/mark-all-read`
Mark all articles (or filtered subset) as read
```typescript
Request: {
  feedId?: number  // Optional: only mark articles from this feed
}
Response: {
  markedCount: number
}
```

**Tasks**:
- [ ] Implement all endpoints
- [ ] Add efficient SQL queries with indexes
- [ ] Implement pagination properly
- [ ] Add read timestamp tracking

### 3.4 Manual Sync Service
**Goal**: ⚠️ **Manual-only** feed refresh (user-triggered, not automated)

**File**: `server/api/sync/index.post.ts`

**Logic**:
1. Get all active feeds
2. For each feed:
   - Fetch and parse feed
   - Compare with existing articles (by guid)
   - Insert only new articles
   - Update feed's `lastFetchedAt`, reset `errorCount` on success
   - On error: increment `errorCount`, set `lastError`, disable feed if `errorCount >= 10`
3. Return summary of sync results

**Features**:
- Process feeds in parallel (with concurrency limit of 5)
- Continue on individual feed failures (use `Promise.allSettled`)
- Update error status in database
- Return detailed results per feed

**Note**: Automated background polling deferred to Phase 2

**Tasks**:
- [ ] Implement manual sync logic
- [ ] Add concurrency control (Promise.allSettled)
- [ ] Implement error count and feed disabling logic
- [ ] Handle partial failures gracefully
- [ ] Return user-friendly sync summary

---

## 4. Frontend Components

### 4.1 State Management
**Goal**: Reactive state for feeds and articles

**File**: `composables/useFeeds.ts`
```typescript
export const useFeeds = () => {
  const feeds = ref<Feed[]>([])
  const selectedFeedId = ref<number | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  const fetchFeeds = async () => { /* ... */ }
  const addFeed = async (url: string) => { /* ... */ }
  const deleteFeed = async (id: number) => { /* ... */ }
  const refreshFeed = async (id: number) => { /* ... */ }

  const selectedFeed = computed(() =>
    feeds.value.find(f => f.id === selectedFeedId.value)
  )

  return {
    feeds,
    selectedFeedId,
    selectedFeed,
    loading,
    error,
    fetchFeeds,
    addFeed,
    deleteFeed,
    refreshFeed
  }
}
```

**File**: `composables/useArticles.ts`
```typescript
export const useArticles = () => {
  const articles = ref<Article[]>([])
  const selectedArticleId = ref<number | null>(null)
  const showUnreadOnly = ref(false)
  const loading = ref(false)

  const fetchArticles = async (feedId?: number) => { /* ... */ }
  const markAsRead = async (id: number, isRead: boolean) => { /* ... */ }
  const markAllAsRead = async (feedId?: number) => { /* ... */ }

  const selectedArticle = computed(() =>
    articles.value.find(a => a.id === selectedArticleId.value)
  )

  const displayedArticles = computed(() => {
    if (showUnreadOnly.value) {
      return articles.value.filter(a => !a.isRead)
    }
    return articles.value
  })

  return {
    articles,
    selectedArticleId,
    selectedArticle,
    showUnreadOnly,
    displayedArticles,
    loading,
    fetchArticles,
    markAsRead,
    markAllAsRead
  }
}
```

**State Synchronization Note**:
Marking an article as read should trigger a feed list refresh to update unread counts, OR use Pinia for shared state management to avoid sync issues.

**Tasks**:
- [ ] Implement both composables
- [ ] Add error handling
- [ ] Add loading states
- [ ] Ensure unread counts update when articles marked as read

### 4.2 Layout Components

#### `components/layout/Sidebar.vue`
**Goal**: Left sidebar showing all feeds

**Features**:
- List all feeds with unread counts
- Highlight selected feed
- "All Items" view (shows all articles)
- "Unread" view (shows only unread)
- Add feed button
- Refresh all button

**Visual Design**:
```
┌─────────────────────┐
│ [+] Add Feed        │
│ [↻] Refresh All     │
├─────────────────────┤
│ All Items      (25) │
│ Unread Only    (25) │
├─────────────────────┤
│ Feeds               │
│ • TechCrunch   (5)  │
│ • Hacker News  (12) │
│ • The Verge    (8)  │
└─────────────────────┘
```

**Tasks**:
- [ ] Create component structure
- [ ] Add click handlers for feed selection
- [ ] Style unread badge
- [ ] Add loading states
- [ ] Make scrollable

#### `components/layout/ArticleList.vue`
**Goal**: Middle pane showing article list

**Features**:
- Show articles for selected feed (or all)
- Display: title, feed name, date, read status
- Highlight selected article
- Show unread indicator (bold title, blue dot)
- "Mark all as read" button
- Infinite scroll or pagination

**Visual Design**:
```
┌────────────────────────────────────┐
│ Feed Name > [Mark All Read]        │
├────────────────────────────────────┤
│ ● Article Title                    │
│   TechCrunch • 2 hours ago         │
├────────────────────────────────────┤
│   Already Read Article             │
│   The Verge • 1 day ago            │
├────────────────────────────────────┤
│ ● Another Unread Article           │
│   Hacker News • 3 hours ago        │
└────────────────────────────────────┘
```

**Tasks**:
- [ ] Create component
- [ ] Implement article list rendering
- [ ] Add read/unread styling
- [ ] Add click handler to select article
- [ ] Auto-mark as read on click
- [ ] Add "Mark all as read" functionality

#### `components/layout/ArticleView.vue`
**Goal**: Right pane showing full article content

**Features**:
- Display full article content
- Show title, author, date, source link
- Render HTML content safely
- "Open original" link
- Star/unstar button (for later)

**Visual Design**:
```
┌──────────────────────────────────────────┐
│ Article Title                            │
│ By Author Name • Published 2 hours ago   │
│ [Open Original] [★ Star]                 │
├──────────────────────────────────────────┤
│                                          │
│ Article content goes here...             │
│ With proper formatting and images.       │
│                                          │
│ Multiple paragraphs of text...          │
│                                          │
└──────────────────────────────────────────┘
```

**Tasks**:
- [ ] Create component
- [ ] Add safe HTML rendering (DOMPurify or v-html with sanitization)
- [ ] Style content for readability
- [ ] Add "Open original" link
- [ ] Handle missing content gracefully

### 4.3 Main Page Layout

**File**: `pages/index.vue`

**Goal**: Three-pane layout using the components above

**Layout**:
```
┌────────────┬────────────────┬─────────────────────┐
│            │                │                     │
│  Sidebar   │  ArticleList   │   ArticleView       │
│            │                │                     │
│  (20%)     │     (30%)      │      (50%)          │
│            │                │                     │
└────────────┴────────────────┴─────────────────────┘
```

**Features**:
- Responsive layout with proper mobile flow
- Handle empty states (no feeds, no articles)

**Mobile Navigation Flow** (✅ Improved UX):
On mobile/tablet (< 768px), use route-based navigation:
1. Default view: Feed list only
2. Tap feed → Navigate to article list view
3. Tap article → Navigate to article view
4. Back button to return to previous view

**Desktop** (>= 768px): Three-pane side-by-side layout

**Onboarding** (✅ First-time user experience):
- If no feeds exist, show prominent "Add your first feed!" CTA
- Optionally pre-populate with 2-3 popular feeds (TechCrunch, Hacker News)

**Tasks**:
- [ ] Create page layout with CSS Grid
- [ ] Import and arrange components
- [ ] Implement mobile navigation flow
- [ ] Add empty state with onboarding CTA
- [ ] Test responsive behavior

---

## 5. Keyboard Shortcuts

### 5.1 Implement Keyboard Navigation
**Goal**: Google Reader-style keyboard shortcuts

**File**: `composables/useKeyboard.ts`

**Shortcuts**:
- `j` / `k` - Next/previous article
- `n` / `p` - Next/previous article (alternative)
- `o` - Open article in new tab
- `m` - Mark current article as read/unread
- `s` - Star current article (for later)
- `shift+a` - Mark all as read
- `r` - Refresh feeds
- `g` then `a` - Go to "All items"
- `g` then `u` - Go to "Unread"
- `?` - Show keyboard shortcuts help

**Implementation**:
```typescript
export const useKeyboard = () => {
  const { articles, selectedArticleId } = useArticles()

  onMounted(() => {
    window.addEventListener('keydown', handleKeyPress)
  })

  onUnmounted(() => {
    window.removeEventListener('keydown', handleKeyPress)
  })

  const handleKeyPress = (e: KeyboardEvent) => {
    // ✅ Improved: Ignore if typing in any input element
    const target = e.target as HTMLElement
    if (
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target.isContentEditable
    ) {
      return
    }

    switch(e.key) {
      case 'j':
        selectNextArticle()
        break
      case 'k':
        selectPreviousArticle()
        break
      // ... more shortcuts
    }
  }

  return { handleKeyPress }
}
```

**Tasks**:
- [ ] Implement keyboard composable
- [ ] Add all shortcuts
- [ ] Prevent conflicts with browser shortcuts
- [ ] Ignore keypresses in input/textarea/contentEditable
- [ ] Add visual feedback for shortcuts
- [ ] Create help modal (press `?`)

---

## 6. Styling & UX Polish

### 6.1 Visual Design
**Goal**: Clean, readable interface inspired by Google Reader

**Design Principles**:
- Minimalist design, focus on content
- High contrast for readability
- Clear visual hierarchy
- Unread items stand out (bold, blue dot)
- Selected items clearly highlighted

**Color Palette** (example):
```css
--background: #ffffff
--surface: #f5f5f5
--border: #e0e0e0
--text-primary: #202124
--text-secondary: #5f6368
--accent: #1a73e8
--unread: #1a73e8
--read: #5f6368
```

**Typography**:
- Sans-serif font (System UI, Inter, or similar)
- Article content: Serif font for readability
- Font sizes: 14px (UI), 16px (article list), 18px (article content)

**Tasks**:
- [ ] Set up Tailwind CSS or custom CSS variables
- [ ] Style all components
- [ ] Add hover states
- [ ] Add focus states for accessibility
- [ ] Test in different browsers

### 6.2 Loading States & Error Handling
**Goal**: Provide clear feedback to users

**Loading States**:
- Skeleton loaders for feed list
- Spinner when fetching articles
- "Refreshing..." indicator on feed refresh
- Disable buttons during operations

**Error States**:
- Toast notifications for errors
- Failed feed indicators in sidebar
- Retry buttons for failed operations
- Clear error messages (not technical jargon)

**Empty States**:
- "No feeds yet. Add your first feed!"
- "No articles in this feed"
- "All caught up! No unread articles."

**Tasks**:
- [ ] Add loading spinners/skeletons
- [ ] Create toast notification component
- [ ] Add error messages to all operations
- [ ] Design and implement empty states
- [ ] Test error scenarios

---

## 7. Testing & Validation

### 7.1 Manual Testing Checklist
**Goal**: Ensure all features work correctly

**Feed Management**:
- [ ] Can add a valid RSS feed
- [ ] Error shown for invalid feed URL
- [ ] Can delete a feed
- [ ] Can manually refresh a feed
- [ ] Unread counts update correctly

**Article Reading**:
- [ ] Articles load for selected feed
- [ ] Can mark article as read/unread
- [ ] Can mark all as read
- [ ] Article content displays correctly
- [ ] HTML content is sanitized

**Navigation**:
- [ ] Can click to select feed
- [ ] Can click to select article
- [ ] Keyboard shortcuts work (j, k, m, etc.)
- [ ] Scrolling works in all panes

**Sync**:
- [ ] Manual sync fetches new articles
- [ ] No duplicate articles created
- [ ] Sync errors are handled gracefully

**UI/UX**:
- [ ] Layout works on different screen sizes
- [ ] Loading states show correctly
- [ ] Error messages are clear
- [ ] Empty states display properly

### 7.2 Test with Real Feeds
**Goal**: Validate with diverse RSS feeds

**Test Feeds**:
- TechCrunch: `https://techcrunch.com/feed/`
- Hacker News: `https://hnrss.org/frontpage`
- The Verge: `https://www.theverge.com/rss/index.xml`
- Ars Technica: `http://feeds.arstechnica.com/arstechnica/index`
- A personal blog (smaller feed)
- A feed with images
- A feed with full content vs summaries

**Tasks**:
- [ ] Add all test feeds
- [ ] Verify parsing works correctly
- [ ] Check content display
- [ ] Test with malformed feeds
- [ ] Test with unreachable feeds

---

## 8. Documentation & Deployment Prep

### 8.1 README Documentation
**Goal**: Document setup and usage

**Sections**:
1. Project overview
2. Installation instructions
3. Running locally
4. Adding your first feed
5. Keyboard shortcuts reference
6. Database schema overview
7. API endpoints documentation
8. Troubleshooting common issues

**Tasks**:
- [ ] Write comprehensive README
- [ ] Add screenshots
- [ ] Document environment variables
- [ ] Add development setup guide

### 8.2 Code Cleanup
**Goal**: Clean, maintainable codebase

**Tasks**:
- [ ] Remove console.logs
- [ ] Add comments to complex functions
- [ ] Remove unused imports
- [ ] Ensure consistent code style
- [ ] Add JSDoc comments to public APIs

---

## Success Criteria

Phase 1 is complete when:

✅ User can add RSS feeds via URL
✅ Feed articles are fetched and stored
✅ User can view articles in three-pane layout
✅ User can mark articles as read/unread
✅ User can navigate with keyboard shortcuts (j/k)
✅ User can delete feeds
✅ User can manually refresh feeds
✅ UI is clean and functional (no styling bugs)
✅ All core features work without crashes
✅ Code is documented and maintainable

---

## Estimated Timeline

- **Setup & Infrastructure**: 2-3 hours
- **Database & Schema (Prisma)**: 1-2 hours
- **Backend APIs**: 4-6 hours
- **Frontend Components**: 6-8 hours
- **Keyboard Shortcuts**: 1-2 hours
- **Styling & Polish**: 3-4 hours
- **Testing**: 2-3 hours
- **Documentation**: 1-2 hours

**Total: 20-30 hours** (3-5 full days of focused work)

**Note**: Timeline assumes familiarity with Nuxt 3 and Prisma. First-time learners should expect 40-60 hours.

---

## Next Steps After Phase 1

Once MVP is complete, we can move to Phase 2:
- Folders/categories for feeds
- Star/favorite articles
- Full-text search
- OPML import/export
- Dark mode
- Performance optimizations