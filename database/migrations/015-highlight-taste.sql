-- Migration 015 — mirror highlights into taste-maker (taste.phareim.no).
-- Apply with: wrangler d1 execute reader-service --remote --file=database/migrations/015-highlight-taste.sql
--
-- Same shape as the SFL mirror (005): each personal-account highlight is
-- best-effort pushed to taste-maker as a `quote` item; taste_item_id records
-- the mirrored item, NULL means taste-maker was unconfigured/unreachable
-- (the backfill script scripts/taste-highlight-sync.mjs repairs those).
ALTER TABLE "Highlight" ADD COLUMN taste_item_id TEXT;
