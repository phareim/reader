#!/usr/bin/env node
/**
 * instapaper-sync.mjs — Sleeper-side collector: Instapaper saves → Reader "Found" feed.
 *
 * A sibling of x-bookmark-sync.mjs. Each run:
 *   1. obtains (or reuses) an OAuth1 access token via Instapaper xAuth,
 *   2. lists the chosen folder's bookmarks (default `unread`) via bookmarks/list,
 *   3. for each *new* save, best-effort fetches the full article HTML
 *      (bookmarks/get_text) so Found cards have real bodies; falls back to the
 *      description,
 *   4. POSTs each to the Reader's generic /api/ingest seam as source=instapaper.
 *
 * The Reader dedupes on guid=`instapaper:<bookmark_id>`, so re-sends are
 * harmless; the local seen-set just avoids re-fetching get_text for known saves.
 *
 * Config (files, not env — cron has no shell):
 *   ~/.config/instapaper/env        INSTAPAPER_CONSUMER_KEY, INSTAPAPER_CONSUMER_SECRET,
 *                                   INSTAPAPER_USERNAME, INSTAPAPER_PASSWORD,
 *                                   optional INSTAPAPER_FOLDER (unread|starred|archive|<id>)
 *   ~/.config/instapaper/token.json cached { oauth_token, oauth_token_secret }
 *   ~/.config/instapaper/state.json { seen_ids: [], last_run, total_ingested }
 *   ~/.config/reader/env            READER_API_URL, READER_MCP_TOKEN
 *
 * The consumer key/secret comes from Instapaper's human-reviewed request form:
 *   https://www.instapaper.com/main/request_oauth_consumer_token
 * Only HMAC-SHA1 is supported; all calls are POST over HTTPS.
 *
 * Flags: --dry-run (fetch + render, don't POST), --verbose, --folder NAME, --no-text.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';

const HOME = os.homedir();
const ICFG = path.join(HOME, '.config', 'instapaper');
const STATE_PATH = path.join(ICFG, 'state.json');
const TOKEN_PATH = path.join(ICFG, 'token.json');
const API = 'https://www.instapaper.com/api/1.1';

const args = process.argv.slice(2);
const DRY = args.includes('--dry-run');
const VERBOSE = args.includes('--verbose') || DRY;
const NO_TEXT = args.includes('--no-text');
const LIMIT = 100; // bookmarks/list max is 500; 100 is plenty per twice-daily run

function strFlag(name, dflt) {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : dflt;
}
function log(...a) { if (VERBOSE) console.error(...a); }
function readEnvFile(p) {
  return Object.fromEntries(
    fs.readFileSync(p, 'utf8').split('\n').filter(l => l.trim() && !l.startsWith('#'))
      .map(l => l.split(/=(.*)/s).slice(0, 2).map(s => s.trim().replace(/^["']|["']$/g, '')))
  );
}

const ienv = readEnvFile(path.join(ICFG, 'env'));
const renv = readEnvFile(path.join(HOME, '.config', 'reader', 'env'));
const READER_URL = renv.READER_API_URL?.replace(/\/$/, '');
const READER_TOKEN = renv.READER_MCP_TOKEN;
if (!READER_URL || !READER_TOKEN) throw new Error('missing READER_API_URL / READER_MCP_TOKEN');
const { INSTAPAPER_CONSUMER_KEY: CK, INSTAPAPER_CONSUMER_SECRET: CS } = ienv;
if (!CK || !CS) throw new Error('missing INSTAPAPER_CONSUMER_KEY / INSTAPAPER_CONSUMER_SECRET');
const FOLDER = strFlag('--folder', ienv.INSTAPAPER_FOLDER || 'unread');

const state = fs.existsSync(STATE_PATH)
  ? JSON.parse(fs.readFileSync(STATE_PATH, 'utf8'))
  : { seen_ids: [], last_run: null, total_ingested: 0 };
const seen = new Set((state.seen_ids || []).map(String));

// --- OAuth 1.0a (HMAC-SHA1) ---
const rfc3986 = s => encodeURIComponent(s).replace(/[!*'()]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase());

function oauthHeader(url, params, tokenSecret = '') {
  const oauth = {
    oauth_consumer_key: CK,
    oauth_nonce: crypto.randomBytes(16).toString('hex'),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: String(Math.floor(Date.now() / 1000)),
    oauth_version: '1.0',
    ...(params.oauth_token ? { oauth_token: params.oauth_token } : {}),
  };
  // All params (oauth + body) go into the signature base, sorted by encoded key.
  const all = { ...params, ...oauth };
  delete all.oauth_token_secret;
  const paramString = Object.keys(all).sort()
    .map(k => `${rfc3986(k)}=${rfc3986(all[k])}`).join('&');
  const base = ['POST', rfc3986(url), rfc3986(paramString)].join('&');
  const key = `${rfc3986(CS)}&${rfc3986(tokenSecret)}`;
  oauth.oauth_signature = crypto.createHmac('sha1', key).update(base).digest('base64');
  return 'OAuth ' + Object.keys(oauth).sort()
    .map(k => `${rfc3986(k)}="${rfc3986(oauth[k])}"`).join(', ');
}

// POST a signed request. `bodyParams` are the non-oauth form params (also signed).
async function signedPost(url, bodyParams, token) {
  const all = { ...bodyParams, ...(token ? { oauth_token: token.oauth_token } : {}) };
  const auth = oauthHeader(url, all, token?.oauth_token_secret || '');
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: auth, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(bodyParams),
  });
  return res;
}

async function ensureToken() {
  let token = fs.existsSync(TOKEN_PATH) ? JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf8')) : null;
  if (token?.oauth_token && token?.oauth_token_secret) return token;
  if (!ienv.INSTAPAPER_USERNAME || !ienv.INSTAPAPER_PASSWORD) {
    throw new Error('no cached token and missing INSTAPAPER_USERNAME / INSTAPAPER_PASSWORD for xAuth');
  }
  log('minting Instapaper xAuth access token…');
  const res = await signedPost(`${API}/oauth/access_token`, {
    x_auth_username: ienv.INSTAPAPER_USERNAME,
    x_auth_password: ienv.INSTAPAPER_PASSWORD,
    x_auth_mode: 'client_auth',
  }, null);
  const text = await res.text();
  if (!res.ok) throw new Error(`xAuth ${res.status}: ${text.slice(0, 200)}`);
  const form = Object.fromEntries(new URLSearchParams(text));
  if (!form.oauth_token || !form.oauth_token_secret) throw new Error(`xAuth bad response: ${text.slice(0, 200)}`);
  token = { oauth_token: form.oauth_token, oauth_token_secret: form.oauth_token_secret };
  fs.writeFileSync(TOKEN_PATH, JSON.stringify(token, null, 2), { mode: 0o600 });
  return token;
}

const esc = s => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

async function getText(token, bookmarkId) {
  if (NO_TEXT) return null;
  try {
    const res = await signedPost(`${API}/bookmarks/get_text`, { bookmark_id: String(bookmarkId) }, token);
    if (!res.ok) { log(`  get_text ${bookmarkId}: ${res.status}`); return null; }
    const html = await res.text();
    return html && html.trim() ? html : null;
  } catch (e) { log(`  get_text ${bookmarkId} failed: ${e.message}`); return null; }
}

function renderBookmark(b, bodyHtml) {
  const url = b.url;
  const title = (b.title || url || 'Untitled').slice(0, 480);
  const desc = b.description || '';
  const content = bodyHtml
    || (desc ? `<p>${esc(desc)}</p>\n<p><a href="${esc(url)}">Read on the original site →</a></p>` : undefined);
  return {
    source: 'instapaper',
    externalId: String(b.bookmark_id),
    url,
    title,
    content,
    summary: desc ? desc.slice(0, 280) : undefined,
    publishedAt: b.time ? new Date(Number(b.time) * 1000).toISOString() : undefined,
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
  return j;
}

// --- main ---
const token = await ensureToken();

const listRes = await signedPost(`${API}/bookmarks/list`, { limit: String(LIMIT), folder_id: FOLDER }, token);
const listText = await listRes.text();
if (!listRes.ok) throw new Error(`bookmarks/list ${listRes.status}: ${listText.slice(0, 200)}`);
let rows;
try { rows = JSON.parse(listText); } catch { throw new Error(`bookmarks/list bad JSON: ${listText.slice(0, 200)}`); }

const bookmarks = (Array.isArray(rows) ? rows : []).filter(r => r.type === 'bookmark' && r.url);
const fresh = bookmarks.filter(b => !seen.has(String(b.bookmark_id)));
log(`folder "${FOLDER}": ${bookmarks.length} bookmark(s), ${fresh.length} new${DRY ? ' (dry-run)' : ''}`);

let ingested = 0, dup = 0, failed = 0;
for (const b of fresh) {
  const body = await getText(token, b.bookmark_id);
  const item = renderBookmark(b, body);
  if (DRY) { log(`  • ${item.title}`); continue; }
  try {
    const r = await postIngest(item);
    if (r.ingested) { ingested++; } else { dup++; }
    seen.add(String(b.bookmark_id));
  } catch (e) {
    failed++; console.error(`  ✗ ${b.bookmark_id}: ${e.message}`);
  }
  await new Promise(r => setTimeout(r, 150));
}

if (!DRY) {
  state.seen_ids = [...seen].slice(-3000);
  state.last_run = new Date().toISOString();
  state.total_ingested = (state.total_ingested || 0) + ingested;
  fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2), { mode: 0o600 });
}

console.error(`done — ingested ${ingested}, already-known ${dup}, failed ${failed}`);
