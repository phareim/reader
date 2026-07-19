-- Migration 018 — "Good read" marks.
-- Apply with: wrangler d1 execute reader-service --remote --file=database/migrations/018-good-reads.sql
--
-- A star at the end of the reader marks an article as a good read. Like
-- Highlight, the mark is independent of the shelf: an article can be a good
-- read without being saved, and unsaving never clears it. Listed by the
-- /good-reads room (GET /api/good-reads), newest first.

CREATE TABLE IF NOT EXISTS "GoodRead" (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  article_id INTEGER NOT NULL REFERENCES "Article"(id) ON DELETE CASCADE,
  created_at TEXT DEFAULT (CURRENT_TIMESTAMP),
  UNIQUE(user_id, article_id)
);

CREATE INDEX IF NOT EXISTS idx_good_read_user_id_created_at ON "GoodRead"(user_id, created_at);
