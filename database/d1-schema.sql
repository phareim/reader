-- D1 Schema for The Librarian RSS Reader
-- Apply with: wrangler d1 execute <db-name> --file=database/d1-schema.sql

PRAGMA foreign_keys = ON;

-- ============================================================================
-- TABLES
-- ============================================================================

-- User table
CREATE TABLE IF NOT EXISTS "User" (
  id TEXT PRIMARY KEY,
  name TEXT,
  email TEXT UNIQUE,
  password_hash TEXT,
  image TEXT,
  created_at TEXT DEFAULT (CURRENT_TIMESTAMP),
  updated_at TEXT DEFAULT (CURRENT_TIMESTAMP),
  mcp_token TEXT UNIQUE,
  mcp_token_created_at TEXT
);

-- Session table (cookie-based auth)
CREATE TABLE IF NOT EXISTS "session" (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  created_at TEXT DEFAULT (CURRENT_TIMESTAMP)
);

-- Feed table
CREATE TABLE IF NOT EXISTS "Feed" (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  site_url TEXT,
  favicon_url TEXT,
  last_fetched_at TEXT,
  last_error TEXT,
  error_count INTEGER DEFAULT 0,
  fetch_interval INTEGER DEFAULT 900,
  is_active INTEGER DEFAULT 1,
  -- 'rss' (default), 'found' (social bookmarks, push-only), or 'manual'
  kind TEXT NOT NULL DEFAULT 'rss',
  created_at TEXT DEFAULT (CURRENT_TIMESTAMP),
  updated_at TEXT DEFAULT (CURRENT_TIMESTAMP),
  UNIQUE(user_id, url)
);

-- Article table (content stored in R2)
CREATE TABLE IF NOT EXISTS "Article" (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  feed_id INTEGER NOT NULL REFERENCES "Feed"(id) ON DELETE CASCADE,
  guid TEXT NOT NULL,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  author TEXT,
  summary TEXT,
  image_url TEXT,
  content_key TEXT,
  published_at TEXT,
  is_read INTEGER DEFAULT 0,
  is_starred INTEGER DEFAULT 0,
  read_at TEXT,
  -- reading position as a fraction of scrollable height (0..1), and when it
  -- was last written (orders the shelf's "Continue reading" strip)
  read_progress REAL NOT NULL DEFAULT 0,
  progress_updated_at TEXT,
  created_at TEXT DEFAULT (CURRENT_TIMESTAMP),
  full_text_status TEXT DEFAULT 'pending',
  full_text_error TEXT,
  -- per-item origin for Found articles ('x-bookmark', …); NULL for RSS
  source TEXT,
  -- SFL idea created by an elevate; set only when the elevate created it
  -- (SFL !existing), so undo can delete the right idea without trusting the
  -- client. NULL otherwise.
  sfl_idea_id TEXT,
  -- normalized URL (server/utils/urlNormalize.ts) for cross-source Found
  -- dedup; set at insert time (migration 012)
  url_norm TEXT,
  UNIQUE(feed_id, guid)
);

-- SavedArticle table
CREATE TABLE IF NOT EXISTS "SavedArticle" (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  article_id INTEGER NOT NULL REFERENCES "Article"(id) ON DELETE CASCADE,
  saved_at TEXT DEFAULT (CURRENT_TIMESTAMP),
  note_key TEXT,
  UNIQUE(user_id, article_id)
);

-- Tag table
CREATE TABLE IF NOT EXISTS "Tag" (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT,
  created_at TEXT DEFAULT (CURRENT_TIMESTAMP),
  UNIQUE(user_id, name)
);

-- FeedTag join table
CREATE TABLE IF NOT EXISTS "FeedTag" (
  feed_id INTEGER NOT NULL REFERENCES "Feed"(id) ON DELETE CASCADE,
  tag_id INTEGER NOT NULL REFERENCES "Tag"(id) ON DELETE CASCADE,
  tagged_at TEXT DEFAULT (CURRENT_TIMESTAMP),
  PRIMARY KEY (feed_id, tag_id)
);

-- SavedArticleTag join table
CREATE TABLE IF NOT EXISTS "SavedArticleTag" (
  saved_article_id INTEGER NOT NULL REFERENCES "SavedArticle"(id) ON DELETE CASCADE,
  tag_id INTEGER NOT NULL REFERENCES "Tag"(id) ON DELETE CASCADE,
  tagged_at TEXT DEFAULT (CURRENT_TIMESTAMP),
  PRIMARY KEY (saved_article_id, tag_id)
);

-- Highlight table — a yellow-pen mark on a passage, optionally annotated.
-- Independent of the shelf: a highlight does not require a SavedArticle and
-- does not mark the article read. Each mark is also pushed to SFL as a
-- self-contained `quote` idea (sfl_idea_id), NULL only when SFL fails soft.
CREATE TABLE IF NOT EXISTS "Highlight" (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  article_id INTEGER NOT NULL REFERENCES "Article"(id) ON DELETE CASCADE,
  sfl_idea_id TEXT,
  quote TEXT NOT NULL,
  note TEXT,
  start_offset INTEGER NOT NULL,
  end_offset INTEGER NOT NULL,
  created_at TEXT DEFAULT (CURRENT_TIMESTAMP)
);

-- GoodRead table (migration 018) — the star at the end of the reader.
-- Independent of the shelf, like Highlight: an article can be a good read
-- without being saved, and unsaving never clears the mark.
CREATE TABLE IF NOT EXISTS "GoodRead" (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  article_id INTEGER NOT NULL REFERENCES "Article"(id) ON DELETE CASCADE,
  created_at TEXT DEFAULT (CURRENT_TIMESTAMP),
  UNIQUE(user_id, article_id)
);

-- Linked social/reading accounts for the Worker-side Found-feed syncs
-- (migrations 010 → 011). One row per (user, source): X, Reddit, Hacker
-- News, ... OAuth sources keep their token set in the credentials JSON
-- (X and Reddit rotate refresh tokens — the internal sync endpoint
-- persists rotations here and is the credentials' ONLY refresher);
-- public sources (Hacker News favorites) carry NULL credentials.
CREATE TABLE IF NOT EXISTS "LinkedSource" (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  source TEXT NOT NULL,           -- 'x' | 'reddit' | 'hackernews' | ...
  external_id TEXT,               -- provider-side id (X user id, reddit/HN username)
  handle TEXT,                    -- display handle for the Sources page
  credentials TEXT,               -- JSON token set; NULL for public sources
  last_sync_at TEXT,
  last_error TEXT,
  created_at TEXT DEFAULT (CURRENT_TIMESTAMP),
  UNIQUE (user_id, source)
);

-- Discover: blogroll-graph feed discovery (migration 016). For each
-- subscribed RSS feed we crawl its site's blogroll (OPML conventions +
-- human /blogroll|/links pages); external blogs become per-user candidates
-- on /discover, ranked by recommender count (DiscoverEdge). Terminal
-- candidate rows (dismissed/subscribed/dead) are kept forever as the
-- dedupe fence — a re-crawl must never resurrect them.
CREATE TABLE IF NOT EXISTS "DiscoverCrawl" (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  feed_id INTEGER NOT NULL REFERENCES "Feed"(id) ON DELETE CASCADE,
  blogroll_url TEXT,            -- where a blogroll was found last time
  blogroll_kind TEXT,           -- 'opml' | 'html' | NULL (none found)
  last_crawled_at TEXT,
  last_error TEXT,
  created_at TEXT DEFAULT (CURRENT_TIMESTAMP),
  UNIQUE (feed_id)
);

CREATE TABLE IF NOT EXISTS "DiscoverCandidate" (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  -- 'unresolved' (site only) -> 'unprobed' (has feed_url) -> 'candidate';
  -- terminal: 'dismissed' | 'subscribed' | 'dead' (unresolvable/unparsable)
  status TEXT NOT NULL DEFAULT 'unresolved',
  site_host TEXT NOT NULL,      -- lowercase host, www. stripped — dedupe key
  site_url TEXT,                -- homepage (outline htmlUrl / scraped link)
  feed_url TEXT,                -- resolved feed URL (NULL while unresolved)
  feed_url_norm TEXT,           -- normalizeUrl(feed_url) for cross-row dedupe
  title TEXT,                   -- outline/anchor text until the probe's parsed title wins
  description TEXT,
  newest_article_at TEXT,       -- from probe; drives the quiet annotation
  attempts INTEGER NOT NULL DEFAULT 0,  -- resolve/probe failures; 3 -> 'dead'
  last_error TEXT,
  created_at TEXT DEFAULT (CURRENT_TIMESTAMP),
  updated_at TEXT DEFAULT (CURRENT_TIMESTAMP),
  UNIQUE (user_id, site_host)
);

CREATE TABLE IF NOT EXISTS "DiscoverEdge" (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  candidate_id INTEGER NOT NULL REFERENCES "DiscoverCandidate"(id) ON DELETE CASCADE,
  feed_id INTEGER REFERENCES "Feed"(id) ON DELETE CASCADE,  -- NULL for labeled sources (migration 017)
  source TEXT NOT NULL DEFAULT 'blogroll',                  -- 'blogroll' | 'hn-frontpage' | 'sfl-saves' | ...
  label TEXT,                                               -- display name when feed_id IS NULL
  created_at TEXT DEFAULT (CURRENT_TIMESTAMP),
  UNIQUE (candidate_id, feed_id, source)
);

-- Full-text search index (migration 014). rowid = Article.id; maintained by
-- server/utils/searchIndex.ts (insert / full-text fetch / ingest replace /
-- delete) — FTS tables don't cascade, so deletes are explicit.
CREATE VIRTUAL TABLE IF NOT EXISTS "ArticleFts" USING fts5(
  title,
  summary,
  body,
  tokenize = 'unicode61 remove_diacritics 2'
);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_session_user_id ON "session"(user_id);
CREATE INDEX IF NOT EXISTS idx_session_token ON "session"(token);

CREATE INDEX IF NOT EXISTS idx_feed_user_id ON "Feed"(user_id);
CREATE INDEX IF NOT EXISTS idx_feed_is_active ON "Feed"(is_active);
CREATE INDEX IF NOT EXISTS idx_feed_user_kind ON "Feed"(user_id, kind);

CREATE INDEX IF NOT EXISTS idx_article_feed_id_is_read ON "Article"(feed_id, is_read);
CREATE INDEX IF NOT EXISTS idx_article_feed_url_norm ON "Article"(feed_id, url_norm);
CREATE INDEX IF NOT EXISTS idx_article_is_read_published_at ON "Article"(is_read, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_article_published_at ON "Article"(published_at DESC);

CREATE INDEX IF NOT EXISTS idx_saved_article_user_id_saved_at ON "SavedArticle"(user_id, saved_at);
CREATE INDEX IF NOT EXISTS idx_saved_article_article_id_user_id ON "SavedArticle"(article_id, user_id);

CREATE INDEX IF NOT EXISTS idx_tag_user_id ON "Tag"(user_id);

CREATE INDEX IF NOT EXISTS idx_highlight_article_user ON "Highlight"(article_id, user_id);
CREATE INDEX IF NOT EXISTS idx_good_read_user_id_created_at ON "GoodRead"(user_id, created_at);

CREATE INDEX IF NOT EXISTS idx_discover_candidate_user_status ON "DiscoverCandidate"(user_id, status);
CREATE INDEX IF NOT EXISTS idx_discover_edge_feed ON "DiscoverEdge"(feed_id);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

CREATE TRIGGER IF NOT EXISTS update_user_updated_at
  BEFORE UPDATE ON "User"
  FOR EACH ROW
  BEGIN
    UPDATE "User" SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id;
  END;

CREATE TRIGGER IF NOT EXISTS update_feed_updated_at
  BEFORE UPDATE ON "Feed"
  FOR EACH ROW
  BEGIN
    UPDATE "Feed" SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id;
  END;
-- Failed credential attempts, for the sign-in/sign-up sliding-window rate
-- limit (server/utils/authRateLimit.ts): >=10 failures against one email in
-- 10 minutes => 429. Rows are cleared on successful sign-in and GC'd after
-- a day.
CREATE TABLE IF NOT EXISTS "auth_attempt" (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL,
  ip TEXT,
  attempted_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_auth_attempt_email_time ON "auth_attempt"(email, attempted_at);
