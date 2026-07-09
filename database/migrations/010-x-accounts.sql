-- Linked X (Twitter) accounts for the Worker-side bookmark sync.
-- One account per user; tokens are the OAuth2 user-context pair from the
-- PKCE link flow (/api/auth/x/start → /callback). X ROTATES the refresh
-- token on every refresh — the sync endpoint persists the rotation here,
-- and nothing else may refresh the same token (see server/utils/xOauth.ts).
CREATE TABLE IF NOT EXISTS "XAccount" (
  user_id TEXT PRIMARY KEY REFERENCES "User"(id) ON DELETE CASCADE,
  x_user_id TEXT NOT NULL,
  handle TEXT,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  obtained_at INTEGER NOT NULL,   -- unix seconds when access_token was minted
  expires_in INTEGER NOT NULL,    -- access_token lifetime in seconds
  last_sync_at TEXT,
  last_error TEXT,
  created_at TEXT DEFAULT (CURRENT_TIMESTAMP)
);
