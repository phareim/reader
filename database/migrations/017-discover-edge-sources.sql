-- Migration 017 — Discover edges beyond the blogroll graph.
-- Apply with: wrangler d1 execute reader-service --remote --file=database/migrations/017-discover-edge-sources.sql
--
-- Discover grows non-blogroll sources (Hacker News front-page frequency,
-- the SFL-saves miner, …) fed through POST /api/discover/candidates. Those
-- recommenders are not Feed rows, so the edge gains a `source` tag and a
-- display `label`, and `feed_id` becomes nullable (NULL = labeled source).
-- SQLite can't relax NOT NULL in place — rebuild the table. NULL feed_ids
-- make the UNIQUE constraint inert for labeled edges; the ingest endpoint
-- dedupes those in code (single-flight, like the crawl).

CREATE TABLE "DiscoverEdge_v2" (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  candidate_id INTEGER NOT NULL REFERENCES "DiscoverCandidate"(id) ON DELETE CASCADE,
  feed_id INTEGER REFERENCES "Feed"(id) ON DELETE CASCADE,  -- NULL for labeled sources
  source TEXT NOT NULL DEFAULT 'blogroll',
  label TEXT,                                               -- display name when feed_id IS NULL
  created_at TEXT DEFAULT (CURRENT_TIMESTAMP),
  UNIQUE (candidate_id, feed_id, source)
);

INSERT INTO "DiscoverEdge_v2" (id, candidate_id, feed_id, source, label, created_at)
  SELECT id, candidate_id, feed_id, 'blogroll', NULL, created_at FROM "DiscoverEdge";

DROP TABLE "DiscoverEdge";
ALTER TABLE "DiscoverEdge_v2" RENAME TO "DiscoverEdge";

CREATE INDEX IF NOT EXISTS idx_discover_edge_feed ON "DiscoverEdge"(feed_id);
