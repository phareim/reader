-- 013: timestamp for the last reading-position write, so the shelf's
-- "Continue reading" strip can order by most recently touched. Set by
-- PATCH /api/articles/:id/progress; NULL for positions saved before this
-- migration (they sort last).

ALTER TABLE "Article" ADD COLUMN progress_updated_at TEXT;
