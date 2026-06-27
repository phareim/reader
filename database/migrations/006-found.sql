-- 006-found.sql — the "Found" feed: a push-only bucket for bookmarks/saves
-- collected from social sources (X bookmarks first, more later).
--
-- Apply to prod with:
--   wrangler d1 execute reader-service --remote --file=database/migrations/006-found.sql
--
-- Both columns are additive and defaulted, so this is safe on a live table.

-- Feed.kind distinguishes ordinary RSS feeds ('rss') from the special
-- push-only buckets: 'found' (social bookmarks) and 'manual' (Claude's
-- manual additions). Existing rows default to 'rss'.
ALTER TABLE "Feed" ADD COLUMN kind TEXT NOT NULL DEFAULT 'rss';

-- Article.source records the per-item origin inside a Found feed
-- ('x-bookmark', and future 'mastodon' / 'reddit' / …). NULL for RSS articles.
ALTER TABLE "Article" ADD COLUMN source TEXT;

CREATE INDEX IF NOT EXISTS idx_feed_user_kind ON "Feed"(user_id, kind);
