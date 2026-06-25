-- Migration 005 — Highlights ("yellow-pen" passage marks with optional notes).
-- Apply with: wrangler d1 execute reader-service --file=database/migrations/005-highlights.sql
--
-- A highlight anchors to plain-text character offsets into the rendered
-- article (start_offset/end_offset) and keeps the exact quote for resilience.
-- Each row mirrors to SFL as a `quote` idea (sfl_idea_id); NULL means SFL was
-- unconfigured/unreachable and the mark lives locally only.

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

CREATE INDEX IF NOT EXISTS idx_highlight_article_user ON "Highlight"(article_id, user_id);
