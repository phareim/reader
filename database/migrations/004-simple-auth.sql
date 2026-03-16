-- Migration: Replace Better Auth with simple email/password auth
-- Add password_hash to User table
ALTER TABLE "User" ADD COLUMN password_hash TEXT;

-- The account, verification tables from Better Auth can be kept or dropped.
-- They are no longer used but dropping them is optional to avoid data loss.
-- Existing session table is reused as-is (compatible schema).
