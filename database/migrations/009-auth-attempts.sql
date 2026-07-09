-- Failed credential attempts, for the sign-in/sign-up sliding-window rate
-- limit (server/utils/authRateLimit.ts): >=10 failures against one email in
-- 10 minutes => 429. Rows are cleared on successful sign-in and GC'd after
-- a day.
CREATE TABLE IF NOT EXISTS "auth_attempt" (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL,
  ip TEXT,
  attempted_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_auth_attempt_email_time ON "auth_attempt"(email, attempted_at);
