-- 012: normalized-URL column for cross-source Found dedup.
-- Populated at insert time by insertArticleWithContent (server/utils/
-- urlNormalize.ts); backfilled for existing rows via
-- POST /api/internal/backfill-url-norm (Bearer NUXT_CRON_KEY, run repeatedly
-- until it reports remaining: 0).

ALTER TABLE "Article" ADD COLUMN url_norm TEXT;

CREATE INDEX IF NOT EXISTS idx_article_feed_url_norm ON "Article"(feed_id, url_norm);
