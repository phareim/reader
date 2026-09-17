-- TypeSafe Jev interest score (2026-09-17). REAL 0..2 or NULL (unscored).
-- Filled by POST /api/internal/score-interest for unscored, unread articles
-- from the last 7 days (server/utils/interest.ts). Used as a gentle boost to
-- the deck's decay half-life (server/api/articles/index.get.ts DECAY_AGE) —
-- it reorders the deck, it never fades or hides an article.
ALTER TABLE "Article" ADD COLUMN interest REAL;
