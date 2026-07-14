#!/usr/bin/env node
/**
 * taste-highlight-backfill.mjs — one-shot: mirror existing Reader highlights
 * into taste-maker as `quote` items (the highlight→taste pipe normally runs
 * live inside the Worker on highlight create; this catches everything from
 * before the pipe existed, plus any live misses where taste_item_id is NULL).
 *
 * Idempotent end-to-end: taste-maker dedupes on
 * `external_ref = "reader-highlight:<id>"`, and rows that already carry a
 * taste_item_id are skipped (send them anyway with --force; dedupe upstream
 * makes that harmless).
 *
 * Access: reads/writes Reader's D1 via `npx wrangler d1 execute` (run from
 * the reader repo on a wrangler-authed host — there is no token-authed
 * highlight-list API, and this is a manual one-shot, not a cron). Only the
 * personal account's highlights are mirrored, mirroring the Worker's
 * isPersonalUser gate.
 *
 * Config: ~/.config/taste/env  TASTE_INGEST_KEY (required)
 *                              TASTE_API_URL (default https://taste.phareim.no)
 * Flags:  --dry-run   list what would be sent, send nothing
 *         --force     also re-send rows that already have taste_item_id
 *
 * Usage: cd ~/github/reader && node scripts/taste-highlight-backfill.mjs
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const PERSONAL_EMAIL = 'phareim@gmail.com';
const DRY_RUN = process.argv.includes('--dry-run');
const FORCE = process.argv.includes('--force');

// --- config ---------------------------------------------------------------
const envPath = path.join(os.homedir(), '.config', 'taste', 'env');
const cfg = {};
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m) cfg[m[1]] = m[2];
  }
}
const TASTE_API_URL = cfg.TASTE_API_URL || 'https://taste.phareim.no';
const TASTE_INGEST_KEY = cfg.TASTE_INGEST_KEY;
if (!TASTE_INGEST_KEY) {
  console.error(`No TASTE_INGEST_KEY in ${envPath}`);
  process.exit(1);
}

// --- read highlights from Reader's D1 --------------------------------------
function d1(command) {
  const out = execFileSync('npx', ['wrangler', 'd1', 'execute', 'reader-service', '--remote', '--json', '--command', command], {
    cwd: path.join(os.homedir(), 'github', 'reader'),
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  // wrangler prints a JSON array of result objects; tolerate leading noise.
  const start = out.indexOf('[');
  return JSON.parse(out.slice(start))[0]?.results ?? [];
}

const rows = d1(`SELECT h.id, h.quote, h.note, h.taste_item_id, a.url AS source_url, a.title AS source_title
  FROM "Highlight" h
  JOIN "Article" a ON a.id = h.article_id
  JOIN "User" u ON u.id = h.user_id
  WHERE u.email = '${PERSONAL_EMAIL}'
  ORDER BY h.id`);

const todo = rows.filter((r) => FORCE || !r.taste_item_id);
console.log(`${rows.length} highlights for ${PERSONAL_EMAIL}; ${todo.length} to send${DRY_RUN ? ' (dry run)' : ''}`);

// --- push each through the idempotent ingest endpoint ----------------------
const updates = [];
let created = 0, deduped = 0, failed = 0;
for (const r of todo) {
  if (DRY_RUN) {
    console.log(`  would send #${r.id}: "${String(r.quote).slice(0, 60)}…" (${r.source_title})`);
    continue;
  }
  try {
    const res = await fetch(`${TASTE_API_URL}/api/ingest/highlight`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${TASTE_INGEST_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        highlight_id: r.id,
        quote: r.quote,
        note: r.note || undefined,
        source_url: r.source_url,
        source_title: r.source_title,
      }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = await res.json();
    const itemId = body?.item?.id;
    if (!itemId) throw new Error('response missing item.id');
    body.created ? created++ : deduped++;
    if (itemId !== r.taste_item_id) {
      updates.push(`UPDATE "Highlight" SET taste_item_id = '${itemId}' WHERE id = ${r.id};`);
    }
    console.log(`  #${r.id} → ${itemId} (${body.created ? 'created' : 'existing'})`);
  } catch (err) {
    failed++;
    console.error(`  #${r.id} FAILED: ${err.message}`);
  }
}

// --- write taste_item_id back in one batch ---------------------------------
if (updates.length) {
  const tmp = path.join(os.tmpdir(), `taste-backfill-${Date.now()}.sql`);
  fs.writeFileSync(tmp, updates.join('\n'));
  execFileSync('npx', ['wrangler', 'd1', 'execute', 'reader-service', '--remote', '--file', tmp], {
    cwd: path.join(os.homedir(), 'github', 'reader'),
    stdio: 'inherit',
  });
  fs.unlinkSync(tmp);
}

console.log(`done: ${created} created, ${deduped} already existed, ${failed} failed, ${updates.length} rows updated`);
if (failed) process.exit(1);
