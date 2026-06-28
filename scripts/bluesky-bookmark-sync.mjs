#!/usr/bin/env node
/**
 * bluesky-bookmark-sync.mjs — Sleeper-side collector: Bluesky bookmarks → Reader "Found" feed.
 *
 * A sibling of x-bookmark-sync.mjs. Each run:
 *   1. opens (or refreshes) an AT Protocol session from a free app password,
 *   2. pages newest-first through the authed user's bookmarks
 *      (app.bsky.bookmark.getBookmarks), stopping once it has caught up to
 *      already-ingested ids (bounded by FIRST_PAGE / MAX_PAGES),
 *   3. renders each new bookmark to HTML *with quoted post + media + link card*
 *      (all carried in the hydrated postView — no extra fetches),
 *   4. POSTs each to the Reader's generic /api/ingest seam as source=bluesky.
 *
 * The Reader dedupes on guid=`bluesky:<at-uri>`, so re-sends are harmless; the
 * local seen-set just avoids re-paging already-known bookmarks.
 *
 * Config (files, not env — cron has no shell):
 *   ~/.config/bluesky/env        BLUESKY_IDENTIFIER (handle or DID),
 *                                BLUESKY_APP_PASSWORD, optional BLUESKY_PDS
 *                                (default https://bsky.social)
 *   ~/.config/bluesky/token.json cached session { accessJwt, refreshJwt, did, handle }
 *   ~/.config/bluesky/state.json { seen_ids: [], last_run, total_ingested }
 *   ~/.config/reader/env         READER_API_URL, READER_MCP_TOKEN
 *
 * Bluesky app passwords are free and minted at Settings → App Passwords; no
 * OAuth dance, no per-call cost. Native bookmarks (the 🔖 in the app) are read
 * back via app.bsky.bookmark.getBookmarks, proxied through your PDS.
 *
 * Flags: --dry-run (fetch + render, don't POST), --verbose, --max-pages N.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const HOME = os.homedir();
const BCFG = path.join(HOME, '.config', 'bluesky');
const STATE_PATH = path.join(BCFG, 'state.json');
const TOKEN_PATH = path.join(BCFG, 'token.json');

const args = process.argv.slice(2);
const DRY = args.includes('--dry-run');
const VERBOSE = args.includes('--verbose') || DRY;
const FIRST_PAGE = 50;                          // bookmarks per page (free — no per-post billing)
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

const benv = readEnvFile(path.join(BCFG, 'env'));
const renv = readEnvFile(path.join(HOME, '.config', 'reader', 'env'));
const READER_URL = renv.READER_API_URL?.replace(/\/$/, '');
const READER_TOKEN = renv.READER_MCP_TOKEN;
if (!READER_URL || !READER_TOKEN) throw new Error('missing READER_API_URL / READER_MCP_TOKEN');
const PDS = (benv.BLUESKY_PDS || 'https://bsky.social').replace(/\/$/, '');
if (!benv.BLUESKY_IDENTIFIER || !benv.BLUESKY_APP_PASSWORD) {
  throw new Error('missing BLUESKY_IDENTIFIER / BLUESKY_APP_PASSWORD in ~/.config/bluesky/env');
}

const state = fs.existsSync(STATE_PATH)
  ? JSON.parse(fs.readFileSync(STATE_PATH, 'utf8'))
  : { seen_ids: [], last_run: null, total_ingested: 0 };
const seen = new Set(state.seen_ids || []);

// --- AT Protocol session (app-password createSession, JWT refreshSession) ---
let session = fs.existsSync(TOKEN_PATH) ? JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf8')) : null;

async function xrpc(nsid, { method = 'GET', token, query, body } = {}) {
  const url = new URL(`${PDS}/xrpc/${nsid}`);
  if (query) for (const [k, v] of Object.entries(query)) if (v != null) url.searchParams.set(k, v);
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${nsid} ${res.status}: ${JSON.stringify(j).slice(0, 300)}`);
  return j;
}

async function ensureSession() {
  if (session?.refreshJwt) {
    try {
      const r = await xrpc('com.atproto.server.refreshSession', { method: 'POST', token: session.refreshJwt });
      session = { accessJwt: r.accessJwt, refreshJwt: r.refreshJwt, did: r.did, handle: r.handle };
      fs.writeFileSync(TOKEN_PATH, JSON.stringify(session, null, 2), { mode: 0o600 });
      log('refreshed Bluesky session');
      return;
    } catch (e) {
      log('refresh failed, creating new session:', e.message);
    }
  }
  const r = await xrpc('com.atproto.server.createSession', {
    method: 'POST',
    body: { identifier: benv.BLUESKY_IDENTIFIER, password: benv.BLUESKY_APP_PASSWORD },
  });
  session = { accessJwt: r.accessJwt, refreshJwt: r.refreshJwt, did: r.did, handle: r.handle };
  fs.writeFileSync(TOKEN_PATH, JSON.stringify(session, null, 2), { mode: 0o600 });
  log('created Bluesky session for', session.handle);
}

const esc = s => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const paras = t => esc(t).split(/\n{2,}/).map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`).join('\n');
const rkeyOf = uri => String(uri || '').split('/').pop();
const postUrl = (handle, uri) => `https://bsky.app/profile/${handle}/post/${rkeyOf(uri)}`;

// Pull display images out of a hydrated embed view (images, or recordWithMedia's media).
function embedImages(embed) {
  if (!embed) return [];
  const t = embed.$type || '';
  if (t.startsWith('app.bsky.embed.images')) {
    return (embed.images || []).map(im => ({ url: im.fullsize || im.thumb, alt: im.alt || '' })).filter(im => im.url);
  }
  if (t.startsWith('app.bsky.embed.recordWithMedia')) return embedImages(embed.media);
  if (t.startsWith('app.bsky.embed.external') && embed.external?.thumb) {
    return [{ url: embed.external.thumb, alt: embed.external.title || '' }];
  }
  return [];
}

// Render the quoted post (embed.record#view) as a blockquote.
function quotedBlock(embed) {
  if (!embed) return '';
  const t = embed.$type || '';
  let rec = null;
  if (t.startsWith('app.bsky.embed.record#') || t === 'app.bsky.embed.record#view') rec = embed.record;
  else if (t.startsWith('app.bsky.embed.recordWithMedia')) rec = embed.record?.record;
  if (!rec || rec.notFound || rec.blocked) return '';
  const qh = rec.author?.handle ? `@${rec.author.handle}` : '';
  const qn = rec.author?.displayName ? ` · ${esc(rec.author.displayName)}` : '';
  const body = paras(rec.value?.text || '');
  return `<blockquote><p><strong>❝ Quoting ${esc(qh)}</strong>${qn}</p>\n${body}</blockquote>`;
}

function externalCard(embed) {
  const ext = embed?.$type?.startsWith('app.bsky.embed.external') ? embed.external : null;
  if (!ext?.uri) return '';
  return `<p><a href="${esc(ext.uri)}">${esc(ext.title || ext.uri)}</a>${ext.description ? ` — ${esc(ext.description)}` : ''}</p>`;
}

function renderPost(view, subjectUri) {
  const post = view.item;
  if (!post || post.notFound || post.blocked || post.$type?.includes('NotFoundPost') || post.$type?.includes('blockedPost')) {
    return null; // deleted / blocked bookmark — skip
  }
  const author = post.author || {};
  const handle = author.handle ? `@${author.handle}` : (author.did || '');
  const text = post.record?.text || '';
  const date = post.record?.createdAt || post.indexedAt;
  const dateStr = date ? new Date(date).toISOString().slice(0, 10) : '';

  const imgs = embedImages(post.embed);
  const imgHtml = imgs.map(im => `<p><img src="${esc(im.url)}" alt="${esc(im.alt)}"></p>`).join('\n');
  const url = postUrl(author.handle || author.did, post.uri || subjectUri);

  const html = [
    `<p><strong>${esc(handle)}</strong>${author.displayName ? ` · ${esc(author.displayName)}` : ''}${dateStr ? ` · ${dateStr}` : ''}</p>`,
    paras(text),
    imgHtml,
    quotedBlock(post.embed),
    externalCard(post.embed),
    `<p><a href="${esc(url)}">View on Bluesky →</a></p>`,
  ].filter(Boolean).join('\n');

  const titleText = text.replace(/\s+/g, ' ').trim();
  const title = titleText
    ? (titleText.length > 90 ? titleText.slice(0, 89) + '…' : titleText)
    : `${handle} on Bluesky`;

  return {
    source: 'bluesky',
    externalId: subjectUri,                 // the at:// uri — globally unique
    url,
    title,
    author: author.handle ? `@${author.handle}` : undefined,
    content: html,
    summary: titleText ? titleText.slice(0, 280) : undefined,
    imageUrl: imgs[0]?.url || undefined,
    publishedAt: date || undefined,
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
await ensureSession();

const fresh = [];
let cursor = null, page = 0;
do {
  const j = await xrpc('app.bsky.bookmark.getBookmarks', {
    token: session.accessJwt,
    query: { limit: String(FIRST_PAGE), cursor },
  });
  const bookmarks = j.bookmarks || [];
  const pageNew = bookmarks.filter(b => !seen.has(b.subject?.uri));
  for (const b of pageNew) {
    const item = renderPost(b, b.subject?.uri);
    if (item) fresh.push(item); else seen.add(b.subject?.uri); // mark unrenderable as seen so we don't retry
  }
  page++;
  log(`page ${page}: ${bookmarks.length} fetched, ${pageNew.length} new (total new ${fresh.length})`);

  cursor = j.cursor || null;
  // Caught up once a page isn't entirely new — older bookmarks below are known.
  if (pageNew.length < bookmarks.length) break;
} while (cursor && page < MAX_PAGES);

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
