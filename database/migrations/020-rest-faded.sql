-- Rest faded articles (2026-09-04). The nightly /api/internal/rest-faded job
-- marks rss articles past the fade horizon (3 half-lives, utils/decay.ts) as
-- read: they were already invisible in the deck, and leaving them unread made
-- every feed-list and deck load scan the whole backlog (12.5K unread rows).
-- rested_at records that the job — not the reader — flipped the flag;
-- read_at stays NULL so reading stats don't count them.
ALTER TABLE "Article" ADD COLUMN rested_at TEXT;

-- Newest article per feed as a correlated MAX() over this index: one seek
-- per feed instead of a GROUP BY over every article the user owns.
CREATE INDEX IF NOT EXISTS idx_article_feed_id_published_at ON "Article"(feed_id, published_at);
