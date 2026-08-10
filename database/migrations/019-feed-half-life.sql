-- Per-feed half-life: how fast a feed's unread articles age out of the deck.
-- NULL = the default pace (72h, applied in SQL via COALESCE). Articles older
-- than 3 half-lives fade from decay-scoped unread queries — they are never
-- marked read, just stop asking for a swipe.
ALTER TABLE "Feed" ADD COLUMN half_life_hours REAL;
