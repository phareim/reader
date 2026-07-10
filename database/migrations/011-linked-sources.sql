-- Generalize the linked-account setup: XAccount (X-only, migration 010)
-- becomes LinkedSource — one row per (user, source) for every account a
-- user connects on /sources (X, Reddit, Hacker News, ...). OAuth sources
-- keep their token set in the credentials JSON blob; public sources
-- (Hacker News favorites) carry NULL credentials and just an external_id.
-- The internal sync endpoint (/api/internal/sync-sources) dispatches on
-- `source` and is the ONLY refresher of any OAuth credentials in here.
CREATE TABLE IF NOT EXISTS "LinkedSource" (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  source TEXT NOT NULL,           -- 'x' | 'reddit' | 'hackernews' | ...
  external_id TEXT,               -- provider-side id (X user id, reddit/HN username)
  handle TEXT,                    -- display handle for the Sources page
  credentials TEXT,               -- JSON token set; NULL for public sources
  last_sync_at TEXT,
  last_error TEXT,
  created_at TEXT DEFAULT (CURRENT_TIMESTAMP),
  UNIQUE (user_id, source)
);

-- Carry over linked X accounts, then retire the one-source table.
INSERT INTO "LinkedSource" (user_id, source, external_id, handle, credentials, last_sync_at, last_error, created_at)
SELECT
  user_id,
  'x',
  x_user_id,
  handle,
  json_object(
    'access_token', access_token,
    'refresh_token', refresh_token,
    'obtained_at', obtained_at,
    'expires_in', expires_in
  ),
  last_sync_at,
  last_error,
  created_at
FROM "XAccount";

DROP TABLE "XAccount";
