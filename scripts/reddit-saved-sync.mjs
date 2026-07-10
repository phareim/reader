#!/usr/bin/env node
/**
 * reddit-saved-sync.mjs — Sleeper-side collector: Reddit saved items → Reader "Found" feed.
 *
 * ⚠️ SUPERSEDED (2026-07-10, never enabled): Reddit sync ships Worker-side
 * instead. Users link their Reddit account from /sources (OAuth2 code flow →
 * LinkedSource table) and POST /api/internal/sync-sources pages the saved
 * listing server-side; the rendering below was ported verbatim to
 * server/utils/redditRender.ts. Kept as reference only.
 *
 * A sibling of x-bookmark-sync.mjs / bluesky-bookmark-sync.mjs / mastodon-*.
 * Reddit's analog to bookmarks is the **saved** list (posts you've saved AND
 * comments you've saved). Each run:
 *   1. mints an OAuth2 bearer token via the "script" app password grant,
 *   2. pages newest-first through GET /user/{username}/saved (mixed t3 posts +
 *      t1 comments), stopping once it reaches already-ingested ids (bounded by
 *      FIRST_PAGE / MAX_PAGES),
 *   3. renders each new item to HTML — post selftext/media/external link, or the
 *      saved comment with its thread context (all from the listing, no extra
 *      fetches; raw_json=1 keeps the HTML un-entity-encoded),
 *   4. POSTs each to the Reader's generic /api/ingest seam as source=reddit.
 *
 * The Reader dedupes on guid=`reddit:<fullname>` (e.g. reddit:t3_abc123), so
 * re-sends are harmless; the local seen-set just avoids re-paging known saves.
 *
 * Auth is a Reddit "script" app (no browser OAuth dance for a personal token):
 * create one at https://www.reddit.com/prefs/apps → "create app" → type **script**.
 * Note the client id (under the app name) and secret. The password grant requires
 * you to be a developer of that app. If the account has 2FA, set the password as
 * "yourpassword:123456" (password:otp) for the run that mints the token.
 *
 * Config (files, not env — cron has no shell):
 *   ~/.config/reddit/env   REDDIT_CLIENT_ID, REDDIT_CLIENT_SECRET,
 *                          REDDIT_USERNAME, REDDIT_PASSWORD,
 *                          optional REDDIT_USER_AGENT
 *   ~/.config/reddit/state.json  { seen_ids: [], last_run, total_ingested }
 *   ~/.config/reader/env   READER_API_URL, READER_MCP_TOKEN
 *
 * Flags: --dry-run (fetch + render, don't POST), --verbose, --max-pages N.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const HOME = os.homedir();
const RCFG = path.join(HOME, '.config', 'reddit');
const STATE_PATH = path.join(RCFG, 'state.json');

const args = process.argv.slice(2);
const DRY = args.includes('--dry-run');
const VERBOSE = args.includes('--verbose') || DRY;
const FIRST_PAGE = 50;                          // saved items per page (Reddit max is 100; free, no billing)
const MAX_PAGES = numFlag('--max-pages', 5);    // hard cap on catch-up paging

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

const denv = readEnvFile(path.join(RCFG, 'env'));
const renv = readEnvFile(path.join(HOME, '.config', 'reader', 'env'));
const READER_URL = renv.READER_API_URL?.replace(/\/$/, '');
const READER_TOKEN = renv.READER_MCP_TOKEN;
if (!READER_URL || !READER_TOKEN) throw new Error('missing READER_API_URL / READER_MCP_TOKEN');
const { REDDIT_CLIENT_ID: CID, REDDIT_CLIENT_SECRET: CSECRET,
        REDDIT_USERNAME: RUSER, REDDIT_PASSWORD: RPASS } = denv;
if (!CID || !CSECRET || !RUSER || !RPASS) {
  throw new Error('missing REDDIT_CLIENT_ID / REDDIT_CLIENT_SECRET / REDDIT_USERNAME / REDDIT_PASSWORD');
}
// Reddit REQUIRES a unique, descriptive User-Agent or it 429s aggressively.
const UA = denv.REDDIT_USER_AGENT || `reader-found-collector/1.0 (by /u/${RUSER})`;

const state = fs.existsSync(STATE_PATH)
  ? JSON.parse(fs.readFileSync(STATE_PATH, 'utf8'))
  : { seen_ids: [], last_run: null, total_ingested: 0 };
const seen = new Set(state.seen_ids || []);

// --- OAuth2 "script" app password grant (token lasts ~1h; we mint fresh per run) ---
async function getToken() {
  const basic = Buffer.from(`${CID}:${CSECRET}`).toString('base64');
  const res = await fetch('https://www.reddit.com/api/v1/access_token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': UA,
    },
    body: new URLSearchParams({
      grant_type: 'password', username: RUSER, password: RPASS, scope: 'read history identity',
    }),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok || !j.access_token) throw new Error(`reddit token ${res.status}: ${JSON.stringify(j).slice(0, 200)}`);
  return j.access_token;
}

let TOKEN = null;
async function rget(url) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${TOKEN}`, 'User-Agent': UA } });
    if (res.status === 429) {
      const reset = Number(res.headers.get('x-ratelimit-reset')) * 1000 || 60000;
      const waitMs = Math.max(1000, Math.min(reset, 60000));
      log(`429 — sleeping ${Math.round(waitMs / 1000)}s`);
      await new Promise(r => setTimeout(r, waitMs));
      continue;
    }
    const j = await res.json().catch(() => null);
    if (!res.ok) throw new Error(`reddit ${res.status}: ${JSON.stringify(j).slice(0, 300)}`);
    return j;
  }
  throw new Error('reddit: exhausted retries');
}

const esc = s => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const permaUrl = p => p ? `https://www.reddit.com${p}` : null;
const isHttp = u => typeof u === 'string' && /^https?:\/\//.test(u);

function leadImage(d) {
  const src = d.preview?.images?.[0]?.source?.url;       // raw_json=1 → not entity-encoded
  if (isHttp(src)) return src;
  if (isHttp(d.thumbnail)) return d.thumbnail;
  if (isHttp(d.url) && /\.(jpe?g|png|gif|webp)$/i.test(d.url)) return d.url;
  return null;
}

// Render a saved POST (t3).
function renderPost(d) {
  const sub = d.subreddit_name_prefixed || (d.subreddit ? `r/${d.subreddit}` : '');
  const date = d.created_utc ? new Date(d.created_utc * 1000).toISOString().slice(0, 10) : '';
  const img = leadImage(d);
  const linksOut = !d.is_self && isHttp(d.url) && !/\.(jpe?g|png|gif|webp)$/i.test(d.url);

  const html = [
    `<p><strong>${esc(d.title || '')}</strong></p>`,
    `<p>${esc(sub)}${d.author ? ` · u/${esc(d.author)}` : ''}${date ? ` · ${date}` : ''}</p>`,
    d.selftext_html || '',                                   // real HTML with raw_json=1
    img ? `<p><img src="${esc(img)}" alt=""></p>` : '',
    linksOut ? `<p><a href="${esc(d.url)}">${esc(d.domain || d.url)} →</a></p>` : '',
    `<p><a href="${esc(permaUrl(d.permalink))}">View on Reddit →</a></p>`,
  ].filter(Boolean).join('\n');

  const title = (d.title || `${sub} post`).slice(0, 200);
  return {
    source: 'reddit',
    externalId: d.name,                                      // fullname e.g. t3_abc123
    url: permaUrl(d.permalink) || d.url,
    title,
    author: d.author ? `u/${d.author}` : undefined,
    content: html,
    summary: (d.selftext || d.title || '').replace(/\s+/g, ' ').trim().slice(0, 280) || undefined,
    imageUrl: img || undefined,
    publishedAt: d.created_utc ? new Date(d.created_utc * 1000).toISOString() : undefined,
  };
}

// Render a saved COMMENT (t1).
function renderComment(d) {
  const sub = d.subreddit_name_prefixed || (d.subreddit ? `r/${d.subreddit}` : '');
  const date = d.created_utc ? new Date(d.created_utc * 1000).toISOString().slice(0, 10) : '';
  const onPost = d.link_title ? `<p>Comment on “${esc(d.link_title)}”</p>` : '';
  const bodyText = (d.body || '').replace(/\s+/g, ' ').trim();

  const html = [
    `<p>${esc(sub)}${d.author ? ` · u/${esc(d.author)}` : ''}${date ? ` · ${date}` : ''}</p>`,
    onPost,
    d.body_html || (bodyText ? `<blockquote><p>${esc(bodyText)}</p></blockquote>` : ''),
    `<p><a href="${esc(permaUrl(d.permalink))}">View on Reddit →</a></p>`,
  ].filter(Boolean).join('\n');

  const titleBase = d.link_title ? `Comment on ${d.link_title}` : (bodyText || `${sub} comment`);
  return {
    source: 'reddit',
    externalId: d.name,                                      // fullname e.g. t1_xyz789
    url: permaUrl(d.permalink) || permaUrl(d.link_permalink),
    title: titleBase.slice(0, 200),
    author: d.author ? `u/${d.author}` : undefined,
    content: html,
    summary: bodyText.slice(0, 280) || undefined,
    publishedAt: d.created_utc ? new Date(d.created_utc * 1000).toISOString() : undefined,
  };
}

function renderChild(child) {
  const d = child?.data;
  if (!d || !d.name) return null;
  if (child.kind === 't3') return d.permalink ? renderPost(d) : null;
  if (child.kind === 't1') return (d.permalink || d.link_permalink) ? renderComment(d) : null;
  return null; // other kinds (rare in saved) — skip
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
TOKEN = await getToken();
log(`got Reddit token for u/${RUSER}`);

const fresh = [];
let after = null, page = 0;
do {
  const qs = new URLSearchParams({ limit: String(FIRST_PAGE), raw_json: '1' });
  if (after) qs.set('after', after);
  const j = await rget(`https://oauth.reddit.com/user/${RUSER}/saved?${qs}`);
  const children = j.data?.children || [];
  const pageNew = children.filter(c => !seen.has(c.data?.name));
  for (const c of pageNew) {
    const item = renderChild(c);
    if (item && item.url) fresh.push(item); else if (c.data?.name) seen.add(c.data.name);
  }
  page++;
  log(`page ${page}: ${children.length} fetched, ${pageNew.length} new (total new ${fresh.length})`);

  after = j.data?.after || null;
  // Caught up once a page isn't entirely new — older saves below are known.
  if (pageNew.length < children.length) break;
} while (after && page < MAX_PAGES);

log(`\n${fresh.length} new saved item(s) to ingest${DRY ? ' (dry-run)' : ''}`);

let ingested = 0, dup = 0, failed = 0;
for (const item of fresh) {
  if (DRY) { log(`  • [${item.externalId}] ${item.title}`); continue; }
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
  state.seen_ids = [...seen].slice(-3000);
  state.last_run = new Date().toISOString();
  state.total_ingested = (state.total_ingested || 0) + ingested;
  fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2), { mode: 0o600 });
}

console.error(`done — ingested ${ingested}, already-known ${dup}, failed ${failed}, pages ${page}`);
