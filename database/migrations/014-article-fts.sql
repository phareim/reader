-- 014: full-text search index over articles. rowid = Article.id; title,
-- summary, and body (HTML-stripped text, capped) are written by
-- server/utils/searchIndex.ts at insert / full-text-fetch / ingest-replace
-- time and removed on article/feed delete (FTS tables don't cascade).
-- Backfill for existing rows: POST /api/internal/backfill-search
-- (Bearer NUXT_CRON_KEY, batched — repeat until remaining: 0).

CREATE VIRTUAL TABLE IF NOT EXISTS "ArticleFts" USING fts5(
  title,
  summary,
  body,
  tokenize = 'unicode61 remove_diacritics 2'
);
