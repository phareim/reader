#!/usr/bin/env node
/**
 * mastodon-bookmark-sync.mjs — Sleeper-side collector: Mastodon bookmarks → Reader "Found" feed.
 *
 * A sibling of x-bookmark-sync.mjs / bluesky-bookmark-sync.mjs. Each run:
 *   1. pages newest-first through the authed user's bookmarks
 *      (GET /api/v1/bookmarks), stopping once it has caught up to
 *      already-ingested ids (bounded by FIRST_PAGE / MAX_PAGES),
 *   2. renders each new bookmark to HTML *with media + boosted post + link card*
 *      (all carried in the Status object — no extra fetches),
 *   3. POSTs each to the Reader's generic /api/ingest seam as source=mastodon.
 *
 * The Reader dedupes on guid=`mastodon:<status-id>`, so re-sends are harmless;
 * the local seen-set just avoids re-paging already-known bookmarks.
 *
 * Auth is a personal access token (no OAuth dance): on your instance go to
 * Preferences → Development → New Application, give it the `read:bookmarks`
 * scope, and copy "Your access token".
 *
 * Mastodon paginates bookmarks by an INTERNAL bookmark id that is only exposed
 * via the `Link: …; rel="next"` header — NOT the status id — so we follow that
 * header rather than constructing max_id ourselves.
 *
 * Config (files, not env — cron has no shell):
 *   ~/.config/mastodon/env        MASTODON_INSTANCE (e.g. https://mastodon.social),
 *                                 MASTODON_ACCESS_TOKEN
 *   ~/.config/mastodon/state.json { seen_ids: [], last_run, total_ingested }
 *   ~/.config/reader/env          READER_API_URL, READER_MCP_TOKEN
 *
 * Flags: --dry-run (fetch + render, don't POST), --verbose, --max-pages N.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const HOME = os.homedir();
const MCFG = path.join(HOME, '.config', 'mastodon');
const STATE_PATH = path.join(MCFG, 'state.json');

const args = process.argv.slice(2);
const DRY = args.includes('--dry-run');
const VERBOSE = args.includes('--verbose') || DRY;
const FIRST_PAGE = 40;                           // bookmarks per page (Mastodon max is 40; free, no billing)
const MAX_PAGES = numFlag('--max-pages', 5);     // hard cap on catch-up paging

function numFlag(name, dflt) {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? Number(args[i + 1]) : dflt;
}
function log(...a) { if (VERBOSE) console.error(...a); }
function readEnvFile(p) {
  return Object.fromEntries(
    fs.readFileSync(p, 'utf8').split('\n').filter(l => l.trim() && !l.startsWith('#'))
      .map(l => l.split(/=(.*)/s).slice(0, 2).map(s => s.trim().replace(/^["']|["']$/g, '')))
  );
}

const menv = readEnvFile(path.join(MCFG, 'env'));
const renv = readEnvFile(path.join(HOME, '.config', 'reader', 'env'));
const READER_URL = renv.READER_API_URL?.replace(/\/$/, '');
const READER_TOKEN = renv.READER_MCP_TOKEN;
if (!READER_URL || !READER_TOKEN) throw new Error('missing READER_API_URL / READER_MCP_TOKEN');
const INSTANCE = (menv.MASTODON_INSTANCE || '').replace(/\/$/, '');
const ACCESS_TOKEN = menv.MASTODON_ACCESS_TOKEN;
if (!INSTANCE || !ACCESS_TOKEN) {
  throw new Error('missing MASTODON_INSTANCE / MASTODON_ACCESS_TOKEN in ~/.config/mastodon/env');
}

const state = fs.existsSync(STATE_PATH)
  ? JSON.parse(fs.readFileSync(STATE_PATH, 'utf8'))
  : { seen_ids: [], last_run: null, total_ingested: 0 };
const seen = new Set((state.seen_ids || []).map(String));

// --- fetch one page; returns { statuses, next } where next is the rel="next" URL ---
async function getPage(url) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${ACCESS_TOKEN}` } });
    if (res.status === 429) {
      const reset = Date.parse(res.headers.get('x-ratelimit-reset') || '') || (Date.now() + 60000);
      const waitMs = Math.max(1000, reset - Date.now() + 1000);
      log(`429 — sleeping ${Math.round(waitMs / 1000)}s`);
      await new Promise(r => setTimeout(r, waitMs));
      continue;
    }
    const j = await res.json().catch(() => null);
    if (!res.ok) throw new Error(`mastodon ${res.status}: ${JSON.stringify(j).slice(0, 300)}`);
    const link = res.headers.get('link') || '';
    const m = link.match(/<([^>]+)>;\s*rel="next"/);
    return { statuses: Array.isArray(j) ? j : [], next: m ? m[1] : null };
  }
  throw new Error('mastodon: exhausted retries');
}

const esc = s => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const stripTags = s => String(s || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

function renderStatus(bookmarked) {
  // You bookmark a status; if it's a boost, the substance is in `reblog`.
  const s = bookmarked.reblog || bookmarked;
  const acct = s.account || {};
  const handle = acct.acct ? `@${acct.acct}` : (acct.username || '');
  const date = s.created_at ? new Date(s.created_at).toISOString().slice(0, 10) : '';

  const media = (s.media_attachments || [])
    .filter(m => m.type === 'image' || m.type === 'gifv' || m.type === 'video')
    .map(m => {
      const u = m.preview_url || m.url;
      return u ? `<p><img src="${esc(u)}" alt="${esc(m.description || '')}"></p>` : '';
    }).filter(Boolean).join('\n');

  const card = s.card?.url
    ? `<p><a href="${esc(s.card.url)}">${esc(s.card.title || s.card.url)}</a>${s.card.description ? ` — ${esc(s.card.description)}` : ''}</p>`
    : '';

  const html = [
    `<p><strong>${esc(handle)}</strong>${acct.display_name ? ` · ${esc(acct.display_name)}` : ''}${date ? ` · ${date}` : ''}</p>`,
    s.content || '',          // Mastodon content is already HTML; the Reader sanitizes at display
    media,
    card,
    s.url ? `<p><a href="${esc(s.url)}">View on Mastodon →</a></p>` : '',
  ].filter(Boolean).join('\n');

  const textPlain = stripTags(s.content);
  const title = textPlain
    ? (textPlain.length > 90 ? textPlain.slice(0, 89) + '…' : textPlain)
    : `${handle} on Mastodon`;
  const leadImg = (s.media_attachments || [])
    .map(m => m.type === 'image' ? (m.preview_url || m.url) : null).find(Boolean)
    || s.card?.image || null;

  return {
    source: 'mastodon',
    externalId: String(bookmarked.id),     // the bookmarked status id (unique on the instance)
    url: s.url || s.uri,
    title,
    author: acct.acct ? `@${acct.acct}` : undefined,
    content: html,
    summary: textPlain ? textPlain.slice(0, 280) : undefined,
    imageUrl: leadImg || undefined,
    publishedAt: s.created_at || undefined,
  };
}

async function postIngest(item) {
  const res = await fetch(`${READER_URL}/api/ingest`, {
    method: 'POST',
    headers: { 'X-MCP-Token': READER_TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify(item),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`reader ingest ${res.status}: ${JSON.stringify(j).slice(0, 200)}`);
  return j; // { ingested, existing }
}

// --- main ---
const fresh = [];
let url = `${INSTANCE}/api/v1/bookmarks?limit=${FIRST_PAGE}`, page = 0;
do {
  const { statuses, next } = await getPage(url);
  const pageNew = statuses.filter(s => !seen.has(String(s.id)));
  for (const s of pageNew) {
    const item = renderStatus(s);
    if (item.url) fresh.push(item); else seen.add(String(s.id));
  }
  page++;
  log(`page ${page}: ${statuses.length} fetched, ${pageNew.length} new (total new ${fresh.length})`);

  url = next;
  // Caught up once a page isn't entirely new — older bookmarks below are known.
  if (pageNew.length < statuses.length) break;
} while (url && page < MAX_PAGES);

log(`\n${fresh.length} new bookmark(s) to ingest${DRY ? ' (dry-run)' : ''}`);

let ingested = 0, dup = 0, failed = 0;
for (const item of fresh) {
  if (DRY) { log(`  • ${item.title}`); continue; }
  try {
    const r = await postIngest(item);
    if (r.ingested) { ingested++; } else { dup++; }
    seen.add(item.externalId);
  } catch (e) {
    failed++; console.error(`  ✗ ${item.externalId}: ${e.message}`);
  }
  await new Promise(r => setTimeout(r, 150));
}

if (!DRY) {
  state.seen_ids = [...seen].slice(-2000);
  state.last_run = new Date().toISOString();
  state.total_ingested = (state.total_ingested || 0) + ingested;
  fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2), { mode: 0o600 });
}

console.error(`done — ingested ${ingested}, already-known ${dup}, failed ${failed}, pages ${page}`);
