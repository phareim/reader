-- Supabase Migration Schema for The Librarian RSS Reader
-- This script creates all tables, indexes, and triggers
-- Run this in the Supabase SQL Editor before running the data migration script

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- TABLES
-- ============================================================================

-- User table (application-level, linked to auth.users)
CREATE TABLE "User" (
  id TEXT PRIMARY KEY,  -- Keep existing CUID format for compatibility
  auth_user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT,
  email TEXT UNIQUE,
  email_verified TIMESTAMPTZ,
  image TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  mcp_token TEXT UNIQUE,  -- Critical for MCP integration
  mcp_token_created_at TIMESTAMPTZ
);

-- Feed table (keep BIGSERIAL for compatibility with existing integer IDs)
CREATE TABLE "Feed" (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  site_url TEXT,
  favicon_url TEXT,
  last_fetched_at TIMESTAMPTZ,
  last_error TEXT,
  error_count INTEGER DEFAULT 0,
  fetch_interval INTEGER DEFAULT 900,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, url)
);

-- Article table
CREATE TABLE "Article" (
  id BIGSERIAL PRIMARY KEY,
  feed_id BIGINT NOT NULL REFERENCES "Feed"(id) ON DELETE CASCADE,
  guid TEXT NOT NULL,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  author TEXT,
  content TEXT,
  summary TEXT,
  image_url TEXT,
  published_at TIMESTAMPTZ,
  is_read BOOLEAN DEFAULT false,
  is_starred BOOLEAN DEFAULT false,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(feed_id, guid)
);

-- SavedArticle table
CREATE TABLE "SavedArticle" (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  article_id BIGINT NOT NULL REFERENCES "Article"(id) ON DELETE CASCADE,
  saved_at TIMESTAMPTZ DEFAULT NOW(),
  note TEXT,
  UNIQUE(user_id, article_id)
);

-- Tag table
CREATE TABLE "Tag" (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, name)
);

-- FeedTag join table (many-to-many: Feed <-> Tag)
CREATE TABLE "FeedTag" (
  feed_id BIGINT NOT NULL REFERENCES "Feed"(id) ON DELETE CASCADE,
  tag_id BIGINT NOT NULL REFERENCES "Tag"(id) ON DELETE CASCADE,
  tagged_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (feed_id, tag_id)
);

-- SavedArticleTag join table (many-to-many: SavedArticle <-> Tag)
CREATE TABLE "SavedArticleTag" (
  saved_article_id BIGINT NOT NULL REFERENCES "SavedArticle"(id) ON DELETE CASCADE,
  tag_id BIGINT NOT NULL REFERENCES "Tag"(id) ON DELETE CASCADE,
  tagged_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (saved_article_id, tag_id)
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Feed indexes
CREATE INDEX idx_feed_user_id ON "Feed"(user_id);
CREATE INDEX idx_feed_is_active ON "Feed"(is_active);

-- Article indexes (optimized for common queries)
CREATE INDEX idx_article_feed_id_is_read ON "Article"(feed_id, is_read);
CREATE INDEX idx_article_is_read_published_at ON "Article"(is_read, published_at DESC);
CREATE INDEX idx_article_published_at ON "Article"(published_at DESC);

-- SavedArticle indexes
CREATE INDEX idx_saved_article_user_id_saved_at ON "SavedArticle"(user_id, saved_at);
CREATE INDEX idx_saved_article_article_id_user_id ON "SavedArticle"(article_id, user_id);

-- Tag indexes
CREATE INDEX idx_tag_user_id ON "Tag"(user_id);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Updated_at trigger function (auto-update updated_at on row changes)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger to User table
CREATE TRIGGER update_user_updated_at
  BEFORE UPDATE ON "User"
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Apply updated_at trigger to Feed table
CREATE TRIGGER update_feed_updated_at
  BEFORE UPDATE ON "Feed"
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE "User" IS 'Application user table linked to Supabase auth.users';
COMMENT ON COLUMN "User".mcp_token IS 'Token for MCP (Model Context Protocol) authentication';
COMMENT ON TABLE "Feed" IS 'RSS/Atom feed subscriptions';
COMMENT ON TABLE "Article" IS 'Articles fetched from RSS feeds';
COMMENT ON TABLE "SavedArticle" IS 'User-saved articles for later reading';
COMMENT ON TABLE "Tag" IS 'User-created tags for organizing feeds and saved articles';
COMMENT ON TABLE "FeedTag" IS 'Many-to-many relationship between feeds and tags';
COMMENT ON TABLE "SavedArticleTag" IS 'Many-to-many relationship between saved articles and tags';
