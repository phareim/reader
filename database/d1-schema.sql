-- D1 Schema for The Librarian RSS Reader
-- Apply with: wrangler d1 execute <db-name> --file=database/d1-schema.sql

PRAGMA foreign_keys = ON;

-- ============================================================================
-- TABLES
-- ============================================================================

-- User table (application-level)
CREATE TABLE IF NOT EXISTS "User" (
  id TEXT PRIMARY KEY,
  name TEXT,
  email TEXT UNIQUE,
  email_verified TEXT,
  image TEXT,
  created_at TEXT DEFAULT (CURRENT_TIMESTAMP),
  updated_at TEXT DEFAULT (CURRENT_TIMESTAMP),
  mcp_token TEXT UNIQUE,
  mcp_token_created_at TEXT
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
  created_at TEXT DEFAULT (CURRENT_TIMESTAMP),
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

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_feed_user_id ON "Feed"(user_id);
CREATE INDEX IF NOT EXISTS idx_feed_is_active ON "Feed"(is_active);

CREATE INDEX IF NOT EXISTS idx_article_feed_id_is_read ON "Article"(feed_id, is_read);
CREATE INDEX IF NOT EXISTS idx_article_is_read_published_at ON "Article"(is_read, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_article_published_at ON "Article"(published_at DESC);

CREATE INDEX IF NOT EXISTS idx_saved_article_user_id_saved_at ON "SavedArticle"(user_id, saved_at);
CREATE INDEX IF NOT EXISTS idx_saved_article_article_id_user_id ON "SavedArticle"(article_id, user_id);

CREATE INDEX IF NOT EXISTS idx_tag_user_id ON "Tag"(user_id);

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
