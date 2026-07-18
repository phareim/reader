-- Migration 016 — Discover: blogroll-graph feed discovery.
-- Apply with: wrangler d1 execute reader-service --remote --file=database/migrations/016-discover.sql
--
-- For each subscribed RSS feed we crawl its site's blogroll (the OPML
-- conventions — <link rel="blogroll">, /.well-known/recommendations.opml,
-- /blogroll.opml — plus human /blogroll|/links pages). External blogs become
-- per-user candidates on /discover, ranked by how many of the user's own
-- sources recommend them (DiscoverEdge). Terminal candidate rows
-- (dismissed/subscribed/dead) are kept forever as a dedupe fence so a
-- re-crawl never resurrects them. DiscoverCrawl is per-feed bookkeeping so
-- the cron can pick stalest-first with a re-crawl floor.

CREATE TABLE IF NOT EXISTS "DiscoverCrawl" (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  feed_id INTEGER NOT NULL REFERENCES "Feed"(id) ON DELETE CASCADE,
  blogroll_url TEXT,            -- where a blogroll was found last time
  blogroll_kind TEXT,           -- 'opml' | 'html' | NULL (none found)
  last_crawled_at TEXT,
  last_error TEXT,
  created_at TEXT DEFAULT (CURRENT_TIMESTAMP),
  UNIQUE (feed_id)
);

CREATE TABLE IF NOT EXISTS "DiscoverCandidate" (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  -- 'unresolved' (site only) -> 'unprobed' (has feed_url) -> 'candidate';
  -- terminal: 'dismissed' | 'subscribed' | 'dead' (unresolvable/unparsable)
  status TEXT NOT NULL DEFAULT 'unresolved',
  site_host TEXT NOT NULL,      -- lowercase host, www. stripped — dedupe key
  site_url TEXT,                -- homepage (outline htmlUrl / scraped link)
  feed_url TEXT,                -- resolved feed URL (NULL while unresolved)
  feed_url_norm TEXT,           -- normalizeUrl(feed_url) for cross-row dedupe
  title TEXT,                   -- outline/anchor text until the probe's parsed title wins
  description TEXT,
  newest_article_at TEXT,       -- from probe; drives the quiet annotation
  attempts INTEGER NOT NULL DEFAULT 0,  -- resolve/probe failures; 3 -> 'dead'
  last_error TEXT,
  created_at TEXT DEFAULT (CURRENT_TIMESTAMP),
  updated_at TEXT DEFAULT (CURRENT_TIMESTAMP),
  UNIQUE (user_id, site_host)
);
CREATE INDEX IF NOT EXISTS idx_discover_candidate_user_status
  ON "DiscoverCandidate"(user_id, status);

CREATE TABLE IF NOT EXISTS "DiscoverEdge" (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  candidate_id INTEGER NOT NULL REFERENCES "DiscoverCandidate"(id) ON DELETE CASCADE,
  feed_id INTEGER NOT NULL REFERENCES "Feed"(id) ON DELETE CASCADE,
  created_at TEXT DEFAULT (CURRENT_TIMESTAMP),
  UNIQUE (candidate_id, feed_id)
);
CREATE INDEX IF NOT EXISTS idx_discover_edge_feed ON "DiscoverEdge"(feed_id);
