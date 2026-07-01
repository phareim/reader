#!/usr/bin/env node
/**
 * x-bookmark-sync.mjs — Sleeper-side collector: X bookmarks → Reader "Found" feed.
 *
 * One of (eventually several) social collectors. Each run:
 *   1. refreshes the X OAuth2 user token if it's near expiry (rotates + persists),
 *   2. pages newest-first through @phareim's bookmarks (stopping once it has
 *      caught up to already-ingested ids — bounded by FIRST_PAGE / MAX_PAGES),
 *   3. renders each new bookmark to HTML *with quoted + reply/thread context*
 *      (all carried in one call via expansions — no extra per-tweet cost),
 *   4. POSTs each to the Reader's generic /api/ingest seam as source=x-bookmark.
 *
 * The Reader dedupes on guid=`x-bookmark:<tweetId>`, so re-sends are harmless;
 * the local seen-set just avoids paying X to re-page already-known bookmarks.
 *
 * Config (files, not env — cron has no shell):
 *   ~/.config/x-bookmarks/env        X_CLIENT_ID, X_CLIENT_SECRET, X_REDIRECT_URI
 *   ~/.config/x-bookmarks/token.json OAuth2 token (access + refresh, rotated here)
 *   ~/.config/x-bookmarks/state.json { seen_ids: [], last_run, total_ingested }
 *   ~/.config/reader/env             READER_API_URL, READER_MCP_TOKEN
 *
 * Flags: --dry-run (fetch + render, don't POST), --verbose, --max-pages N.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const HOME = os.homedir();
const XCFG = path.join(HOME, '.config', 'x-bookmarks');
const STATE_PATH = path.join(XCFG, 'state.json');
const TOKEN_PATH = path.join(XCFG, 'token.json');

const args = process.argv.slice(2);
const DRY = args.includes('--dry-run');
const VERBOSE = args.includes('--verbose') || DRY;
const FIRST_PAGE = 25;                 // posts fetched on the first page (X charges per post returned)
const MAX_PAGES = numFlag('--max-pages', 5); // hard cap: 5 × 25 = 125 posts worst-case catch-up

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

const xenv = readEnvFile(path.join(XCFG, 'env'));
const renv = readEnvFile(path.join(HOME, '.config', 'reader', 'env'));
const READER_URL = renv.READER_API_URL?.replace(/\/$/, '');
const READER_TOKEN = renv.READER_MCP_TOKEN;
if (!READER_URL || !READER_TOKEN) throw new Error('missing READER_API_URL / READER_MCP_TOKEN');

let tok = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf8'));
const state = fs.existsSync(STATE_PATH)
  ? JSON.parse(fs.readFileSync(STATE_PATH, 'utf8'))
  : { seen_ids: [], last_run: null, total_ingested: 0 };
const seen = new Set(state.seen_ids || []);

// --- OAuth token refresh (rotating refresh token is persisted) ---
async function ensureToken() {
  const age = Math.floor(Date.now() / 1000) - (tok.obtained_at || 0);
  if (age < (tok.expires_in || 7200) - 300) return;
  log('refreshing X token…');
  const basic = Buffer.from(`${xenv.X_CLIENT_ID}:${xenv.X_CLIENT_SECRET}`).toString('base64');
  const res = await fetch('https://api.x.com/2/oauth2/token', {
    method: 'POST',
    headers: { Authorization: `Basic ${basic}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: tok.refresh_token }),
  });
  const j = await res.json();
  if (!res.ok || !j.access_token) throw new Error('token refresh failed: ' + JSON.stringify(j));
  j.obtained_at = Math.floor(Date.now() / 1000);
  if (!j.refresh_token) j.refresh_token = tok.refresh_token; // some responses omit; keep prior
  tok = j;
  fs.writeFileSync(TOKEN_PATH, JSON.stringify(j, null, 2), { mode: 0o600 });
}

async function xget(url) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${tok.access_token}` } });
    if (res.status === 429) {
      const reset = Number(res.headers.get('x-rate-limit-reset')) * 1000;
      const waitMs = Math.max(1000, reset - Date.now() + 1000);
      log(`429 — sleeping ${Math.round(waitMs / 1000)}s`);
      await new Promise(r => setTimeout(r, waitMs));
      continue;
    }
    const j = await res.json();
    if (!res.ok) throw new Error(`X ${res.status}: ${JSON.stringify(j).slice(0, 300)}`);
    return j;
  }
  throw new Error('X: exhausted retries');
}

const esc = s => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const paras = t => esc(t).split(/\n{2,}/).map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`).join('\n');
// Native X Article bodies (`article.plain_text`) separate blocks with a single \n
// and carry no structure. Detect headings heuristically: a short, few-word line
// that doesn't end in sentence/clause punctuation (body paragraphs run long and
// end in '.' or a closing quote). The reader's DOMPurify allowlist passes <h2>.
const TERMINAL = new Set(['.', ',', ':', ';', '!', '?', ')', '”', '"', '’', "'"]);
const looksHeading = s => s.length <= 70 && s.split(/\s+/).length <= 10 && !TERMINAL.has(s.slice(-1));
const articleBody = t => String(t || '').split(/\n+/).map(l => l.trim()).filter(Boolean)
  .map(l => looksHeading(l) ? `<h2>${esc(l)}</h2>` : `<p>${esc(l)}</p>`).join('\n');
const mediaUrl = m => m ? (m.url || m.preview_image_url) : null;

// Render a native X Article bookmark (long-form) to HTML from the `article` field.
function renderArticle(t, usersById, mediaByKey) {
  const author = usersById.get(t.author_id) || {};
  const handle = author.username ? `@${author.username}` : t.author_id;
  const date = t.created_at ? new Date(t.created_at).toISOString().slice(0, 10) : '';
  const a = t.article || {};
  const statusUrl = `https://x.com/${author.username || 'i'}/status/${t.id}`;

  const cover = mediaByKey.get(a.cover_media);
  const coverUrl = mediaUrl(cover);
  const inline = (a.media_entities || [])
    .filter(k => k !== a.cover_media)
    .map(k => mediaUrl(mediaByKey.get(k))).filter(Boolean)
    .map(u => `<p><img src="${esc(u)}"></p>`).join('\n');

  const html = [
    `<p><strong>${esc(handle)}</strong>${author.name ? ` · ${esc(author.name)}` : ''}${date ? ` · ${date}` : ''}</p>`,
    coverUrl ? `<p><img src="${esc(coverUrl)}" alt="${esc(a.title || '')}"></p>` : '',
    articleBody(a.plain_text || ''),
    inline,
    `<p><a href="${esc(statusUrl)}">View on X →</a></p>`,
  ].filter(Boolean).join('\n');

  const title = (a.title || '').replace(/\s+/g, ' ').trim() || `${handle} on X`;
  const summary = a.preview_text?.trim() || (a.plain_text || '').replace(/\s+/g, ' ').trim().slice(0, 280);
  const leadImg = coverUrl
    || (a.media_entities || []).map(k => mediaUrl(mediaByKey.get(k))).find(Boolean)
    || null;

  return {
    source: 'x-bookmark',
    externalId: t.id,
    url: statusUrl,
    title,
    author: author.username ? `@${author.username}` : undefined,
    content: html,
    summary: summary || undefined,
    imageUrl: leadImg || undefined,
    publishedAt: t.created_at || undefined,
  };
}

// Render a bookmark (+ its quoted/replied context, all from `includes`) to HTML.
function renderTweet(t, usersById, tweetsById, mediaByKey) {
  if (t.article) return renderArticle(t, usersById, mediaByKey);
  const author = usersById.get(t.author_id) || {};
  const handle = author.username ? `@${author.username}` : t.author_id;
  const text = t.note_tweet?.text || t.text || '';
  const date = t.created_at ? new Date(t.created_at).toISOString().slice(0, 10) : '';

  const refs = t.referenced_tweets || [];
  const repliedTo = refs.find(r => r.type === 'replied_to');
  const quoted = refs.find(r => r.type === 'quoted');

  const mediaImgs = (t.attachments?.media_keys || [])
    .map(k => mediaByKey.get(k)).filter(Boolean)
    .map(m => { const u = m.url || m.preview_image_url; return u ? `<p><img src="${esc(u)}" alt="${esc(m.alt_text || '')}"></p>` : ''; })
    .join('\n');

  const ctxBlock = (ref, labelPrefix) => {
    const rt = ref && tweetsById.get(ref.id);
    if (!rt) return '';
    const ra = usersById.get(rt.author_id) || {};
    const rh = ra.username ? `@${ra.username}` : '';
    const body = paras(rt.note_tweet?.text || rt.text || '');
    return `<blockquote><p><strong>${labelPrefix} ${esc(rh)}</strong></p>\n${body}</blockquote>`;
  };

  const links = (t.entities?.urls || [])
    .filter(u => u.expanded_url && !/\/(photo|video)\/\d/.test(u.expanded_url) && !u.expanded_url.includes('/status/'))
    .map(u => `<a href="${esc(u.expanded_url)}">${esc(u.display_url || u.expanded_url)}</a>`);
  const uniqLinks = [...new Set(links)];

  const html = [
    `<p><strong>${esc(handle)}</strong>${author.name ? ` · ${esc(author.name)}` : ''}${date ? ` · ${date}` : ''}</p>`,
    repliedTo ? ctxBlock(repliedTo, '↳ Replying to') : '',
    paras(text),
    mediaImgs,
    quoted ? ctxBlock(quoted, '❝ Quoting') : '',
    uniqLinks.length ? `<p>${uniqLinks.join(' · ')}</p>` : '',
    `<p><a href="https://x.com/${esc(author.username || 'i')}/status/${esc(t.id)}">View on X →</a></p>`,
  ].filter(Boolean).join('\n');

  const titleText = text.replace(/\s+/g, ' ').trim();
  const title = titleText
    ? (titleText.length > 90 ? titleText.slice(0, 89) + '…' : titleText)
    : `${handle} on X`;
  const leadImg = (t.attachments?.media_keys || [])
    .map(k => mediaByKey.get(k)).filter(Boolean)
    .map(m => m.url || m.preview_image_url).find(Boolean) || null;

  return {
    source: 'x-bookmark',
    externalId: t.id,
    url: `https://x.com/${author.username || 'i'}/status/${t.id}`,
    title,
    author: author.username ? `@${author.username}` : undefined,
    content: html,
    summary: titleText ? titleText.slice(0, 280) : undefined,
    imageUrl: leadImg || undefined,
    publishedAt: t.created_at || undefined,
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
await ensureToken();

const me = await xget('https://api.x.com/2/users/me');
const myId = me.data?.id;
if (!myId) throw new Error('users/me failed');

const params = new URLSearchParams({
  max_results: String(FIRST_PAGE),
  expansions: 'author_id,attachments.media_keys,referenced_tweets.id,referenced_tweets.id.author_id,article.cover_media,article.media_entities',
  'tweet.fields': 'id,text,note_tweet,article,created_at,lang,entities,referenced_tweets,attachments,conversation_id',
  'user.fields': 'id,name,username',
  'media.fields': 'media_key,type,url,preview_image_url,alt_text',
});

const fresh = [];
let next = null, page = 0;
do {
  if (next) params.set('pagination_token', next); else params.delete('pagination_token');
  const j = await xget(`https://api.x.com/2/users/${myId}/bookmarks?${params}`);
  const data = j.data || [];
  const usersById = new Map((j.includes?.users || []).map(u => [u.id, u]));
  const tweetsById = new Map((j.includes?.tweets || []).map(t => [t.id, t]));
  const mediaByKey = new Map((j.includes?.media || []).map(m => [m.media_key, m]));

  const pageNew = data.filter(t => !seen.has(t.id));
  for (const t of pageNew) fresh.push(renderTweet(t, usersById, tweetsById, mediaByKey));
  page++;
  log(`page ${page}: ${data.length} fetched, ${pageNew.length} new (total new ${fresh.length})`);

  next = j.meta?.next_token || null;
  // Stop once we've caught up: a page that wasn't entirely new means older
  // bookmarks below are already ingested. Keep paging only on a full-new page.
  if (pageNew.length < data.length) break;
} while (next && page < MAX_PAGES);

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
  // Keep the seen-set bounded (newest ~2000). fresh ids already added above.
  const merged = [...seen];
  state.seen_ids = merged.slice(-2000);
  state.last_run = new Date().toISOString();
  state.total_ingested = (state.total_ingested || 0) + ingested;
  fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2), { mode: 0o600 });
}

console.error(`done — ingested ${ingested}, already-known ${dup}, failed ${failed}, pages ${page}`);
