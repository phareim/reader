#!/usr/bin/env node
/**
 * sleeper-articles-sync.mjs — Sleeper-side collector: the Sleeper Articles service
 * (~/chat/articles, the SFL-bookmark extraction pipeline) → Reader "Found" feed.
 *
 * The seventh Found collector (siblings: x / bluesky / mastodon / reddit /
 * instapaper / ai-digest). Where the social collectors read *one bookmark → one
 * card*, this one reads the already-extracted articles the Sleeper Articles API
 * serves (full Markdown bodies, summaries, key points) and normalizes each into
 * one Found card. Every `status=ready` item flows in regardless of kind
 * (article / video / post / digest). Each run:
 *   1. pages the articles list newest-first (GET /?status=ready&cursor=…),
 *      stopping once it has caught up to already-ingested ids (bounded by
 *      PAGE_SIZE / MAX_PAGES / MAX_ITEMS),
 *   2. fetches each new article's full doc (GET /:id — the list view strips
 *      content_md/embed_html), renders it to HTML by kind (Markdown→HTML for
 *      articles/digests, a media card for videos, a post card for X posts),
 *   3. POSTs each to the Reader's generic /api/ingest seam as
 *      source=sleeper-articles, externalId=<article id> (guid idempotent).
 *
 * The Reader dedupes on guid=`sleeper-articles:<id>`, so re-sends are harmless;
 * the local seen-set just avoids re-fetching already-known articles.
 *
 * FIRST RUN: the Articles service already holds hundreds of ready articles.
 * Run once with `--seed` to mark the current backlog as seen WITHOUT ingesting,
 * so only genuinely new articles flow in afterwards. (Drop `--seed`, or raise
 * `--max-items`, if you actually want the backlog imported.)
 *
 * Config (files, not env — cron has no shell):
 *   ~/.config/sleeper-articles/env   ARTICLES_API_URL   (default http://127.0.0.1:3003)
 *                                    ARTICLES_API_KEY   (optional Bearer; the
 *                                       list/read endpoints are public today,
 *                                       but it is sent if present)
 *   ~/.config/sleeper-articles/state.json  { seen_ids, last_run, total_ingested }
 *   ~/.config/reader/env             READER_API_URL, READER_MCP_TOKEN
 *
 * Flags:
 *   --dry-run        fetch + render + print, do NOT POST (implies --verbose)
 *   --verbose        log paging, item counts, errors
 *   --seed           mark all current ready ids as seen, ingest nothing (baseline)
 *   --page-size N    articles per list page (default 50, capped at 100 by the API)
 *   --max-pages N    hard cap on catch-up paging (default 8)
 *   --max-items N    hard cap on articles ingested per run (default 60)
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const HOME = os.homedir();
const ACFG = path.join(HOME, '.config', 'sleeper-articles');
const STATE_PATH = path.join(ACFG, 'state.json');

const args = process.argv.slice(2);
const DRY = args.includes('--dry-run');
const SEED = args.includes('--seed');
const VERBOSE = args.includes('--verbose') || DRY;
const PAGE_SIZE = Math.min(numFlag('--page-size', 50), 100);
const MAX_PAGES = numFlag('--max-pages', 8);
const MAX_ITEMS = numFlag('--max-items', 60);

function numFlag(name, dflt) {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? Number(args[i + 1]) : dflt;
}
function log(...a) { if (VERBOSE) console.error(...a); }
function readEnvFile(p) {
  if (!fs.existsSync(p)) return {};
  return Object.fromEntries(
    fs.readFileSync(p, 'utf8').split('\n').filter(l => l.trim() && !l.startsWith('#'))
      .map(l => l.split(/=(.*)/s).slice(0, 2).map(s => s.trim().replace(/^["']|["']$/g, '')))
  );
}

// --- config ---
const aenv = readEnvFile(path.join(ACFG, 'env'));
const renv = readEnvFile(path.join(HOME, '.config', 'reader', 'env'));

const READER_URL = renv.READER_API_URL?.replace(/\/$/, '');
const READER_TOKEN = renv.READER_MCP_TOKEN;
if (!READER_URL || !READER_TOKEN) throw new Error('missing READER_API_URL / READER_MCP_TOKEN in ~/.config/reader/env');

const ARTICLES_URL = (aenv.ARTICLES_API_URL || 'http://127.0.0.1:3003').replace(/\/$/, '');
const ARTICLES_KEY = aenv.ARTICLES_API_KEY || '';

const state = fs.existsSync(STATE_PATH)
  ? JSON.parse(fs.readFileSync(STATE_PATH, 'utf8'))
  : { seen_ids: [], last_run: null, total_ingested: 0 };
const seen = new Set((state.seen_ids || []).map(String));

// --- small HTTP helper (timeout via AbortController) ---
async function apiGet(pathAndQuery) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 15000);
  try {
    const headers = {};
    if (ARTICLES_KEY) headers.Authorization = `Bearer ${ARTICLES_KEY}`;
    const res = await fetch(`${ARTICLES_URL}${pathAndQuery}`, { headers, signal: ctl.signal });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`articles ${pathAndQuery} ${res.status}: ${JSON.stringify(j).slice(0, 200)}`);
    return j;
  } finally {
    clearTimeout(t);
  }
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

// --- rendering ---
const esc = s => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const paras = t => esc(t).split(/\n{2,}/).filter(p => p.trim()).map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`).join('\n');
const isHttp = u => /^https?:\/\//i.test(String(u || ''));

// Compact Markdown → HTML. content_md is Readability/turndown-style markdown, so
// it is regular; the Reader display-sanitizes with DOMPurify, so we can be
// liberal. Handles fenced code, headings, hr, blockquotes, lists, images, links,
// bold/italic, inline code, and paragraphs. Not a spec-complete parser.
function inline(raw) {
  const codes = [];
  let s = String(raw).replace(/`([^`]+)`/g, (_, c) => { codes.push(c); return `${codes.length - 1}`; });
  s = esc(s);
  s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g, (_, alt, url) => `<img src="${url}" alt="${alt}">`);
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g, (_, t, url) => `<a href="${url}">${t}</a>`);
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/__([^_]+)__/g, '<strong>$1</strong>');
  s = s.replace(/(^|[^*])\*([^*\s][^*]*?)\*/g, '$1<em>$2</em>');
  s = s.replace(/(\d+)/g, (_, i) => `<code>${esc(codes[i])}</code>`);
  return s;
}
function mdToHtml(md) {
  const lines = String(md || '').replace(/\r\n?/g, '\n').split('\n');
  const out = [];
  let i = 0;
  const blockStart = l => /^(#{1,6}\s|```|\s*>|\s*[-*+]\s|\s*\d+\.\s)/.test(l) || /^(\s*[-*_]\s*){3,}$/.test(l);
  while (i < lines.length) {
    const line = lines[i];
    if (/^```/.test(line.trim())) {
      const buf = []; i++;
      while (i < lines.length && !/^```/.test(lines[i].trim())) { buf.push(lines[i]); i++; }
      i++; out.push(`<pre><code>${esc(buf.join('\n'))}</code></pre>`); continue;
    }
    if (!line.trim()) { i++; continue; }
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) { out.push(`<h${h[1].length}>${inline(h[2].trim())}</h${h[1].length}>`); i++; continue; }
    if (/^(\s*[-*_]\s*){3,}$/.test(line)) { out.push('<hr>'); i++; continue; }
    if (/^\s*>/.test(line)) {
      const buf = [];
      while (i < lines.length && /^\s*>/.test(lines[i])) { buf.push(lines[i].replace(/^\s*>\s?/, '')); i++; }
      out.push(`<blockquote>${mdToHtml(buf.join('\n'))}</blockquote>`); continue;
    }
    if (/^\s*[-*+]\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i])) { items.push(lines[i].replace(/^\s*[-*+]\s+/, '')); i++; }
      out.push(`<ul>${items.map(t => `<li>${inline(t)}</li>`).join('')}</ul>`); continue;
    }
    if (/^\s*\d+\.\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) { items.push(lines[i].replace(/^\s*\d+\.\s+/, '')); i++; }
      out.push(`<ol>${items.map(t => `<li>${inline(t)}</li>`).join('')}</ol>`); continue;
    }
    const buf = [];
    while (i < lines.length && lines[i].trim() && !blockStart(lines[i])) { buf.push(lines[i]); i++; }
    out.push(`<p>${inline(buf.join('\n')).replace(/\n/g, '<br>')}</p>`);
  }
  return out.join('\n');
}
function firstImage(md) {
  const m = String(md || '').match(/!\[[^\]]*\]\(([^)\s]+)/) || String(md || '').match(/<img[^>]+src=["']?([^"'\s>]+)/i);
  return m ? m[1] : undefined;
}
function fmtDuration(sec) {
  const s = Number(sec);
  if (!s) return '';
  const m = Math.round(s / 60);
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m} min`;
}

function renderPostData(pd, url) {
  const a = pd.author || {};
  const handle = a.handle ? `@${a.handle}` : '';
  const date = pd.created_at ? new Date(pd.created_at).toISOString().slice(0, 10) : '';
  const text = pd.note_text || pd.text || '';
  const media = (pd.media || []).map(m => m.url || m.poster_url).filter(Boolean)
    .map(u => `<p><img src="${esc(u)}" alt=""></p>`).join('\n');
  const q = pd.quoted;
  const quoted = q
    ? `<blockquote><p><strong>❝ Quoting ${esc(q.author?.handle ? '@' + q.author.handle : '')}</strong></p>\n${paras(q.text || '')}</blockquote>`
    : '';
  const html = [
    `<p><strong>${esc(handle)}</strong>${a.name ? ` · ${esc(a.name)}` : ''}${date ? ` · ${date}` : ''}</p>`,
    paras(text),
    media,
    quoted,
    isHttp(url) ? `<p><a href="${esc(url)}">View on X →</a></p>` : '',
  ].filter(Boolean).join('\n');
  return { html, imageUrl: (pd.media || []).map(m => m.url || m.poster_url).find(Boolean) };
}

// article row (from GET /:id) → Reader ingest item, or null to skip.
function renderArticle(a) {
  const doc = a.doc || {};
  const contentUrl = a.content_url || `${ARTICLES_URL}/${a.id}`;
  const url = isHttp(a.url) ? a.url : contentUrl;
  const summary = (doc.summary || doc.sfl_summary || '').replace(/\s+/g, ' ').trim().slice(0, 280) || undefined;
  const publishedAt = doc.sfl_created_at || a.created_at || undefined;

  let html = '', imageUrl;

  if (a.kind === 'post' && doc.post_data) {
    const r = renderPostData(doc.post_data, url);
    html = r.html; imageUrl = r.imageUrl;
  } else if (a.kind === 'video') {
    const meta = [doc.author_name && `<strong>${esc(doc.author_name)}</strong>`, fmtDuration(doc.duration_seconds)]
      .filter(Boolean).join(' · ');
    html = [
      meta ? `<p>${meta}</p>` : '',
      doc.thumbnail_url ? `<p><img src="${esc(doc.thumbnail_url)}" alt=""></p>` : '',
      doc.summary ? `<p>${esc(doc.summary)}</p>` : '',
      isHttp(a.url) ? `<p><a href="${esc(a.url)}">Watch on ${esc(doc.video_provider || 'source')} →</a></p>` : '',
    ].filter(Boolean).join('\n');
    imageUrl = doc.thumbnail_url || undefined;
  } else {
    // article / digest / anything with a markdown body
    const body = mdToHtml(doc.content_md || doc.summary || doc.sfl_summary || '');
    if (!body) return null; // nothing renderable
    html = [
      body,
      isHttp(a.url) ? `<p><a href="${esc(a.url)}">View original →</a></p>` : '',
    ].filter(Boolean).join('\n');
    imageUrl = firstImage(doc.content_md);
  }

  return {
    source: 'sleeper-articles',
    externalId: String(a.id),
    url,
    title: (a.title || '').slice(0, 500) || `Article ${a.id}`,
    author: doc.post_data?.author?.name || doc.author_name || undefined,
    content: html || undefined,
    summary,
    imageUrl: isHttp(imageUrl) ? imageUrl : undefined,
    publishedAt,
  };
}

// --- main ---
const freshIds = [];   // ids to fetch+ingest (newest-first)
const seedIds = [];    // ids to just mark seen (--seed)
let cursor = null, page = 0;

do {
  const q = new URLSearchParams({ status: 'ready', limit: String(PAGE_SIZE) });
  if (cursor != null) q.set('cursor', String(cursor));
  const j = await apiGet(`/?${q.toString()}`);
  const rows = j.articles || [];
  const pageNew = rows.filter(r => !seen.has(String(r.id)));
  for (const r of pageNew) {
    if (SEED) { seedIds.push(String(r.id)); continue; }
    if (freshIds.length < MAX_ITEMS) freshIds.push(r.id);
  }
  page++;
  log(`page ${page}: ${rows.length} fetched, ${pageNew.length} new (queued ${SEED ? seedIds.length : freshIds.length})`);

  cursor = j.has_more ? j.next_cursor : null;
  // Caught up once a page isn't entirely new — older rows below are known.
  if (!SEED && (pageNew.length < rows.length || freshIds.length >= MAX_ITEMS)) break;
} while (cursor != null && page < MAX_PAGES);

if (SEED) {
  for (const id of seedIds) seen.add(id);
  if (!DRY) {
    state.seen_ids = [...seen].slice(-4000);
    state.last_run = new Date().toISOString();
    fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2), { mode: 0o600 });
  }
  console.error(`seeded — ${seedIds.length} existing ready article(s) marked seen, none ingested${DRY ? ' (dry-run: not written)' : ''}`);
  process.exit(0);
}

log(`\n${freshIds.length} new article(s) to ingest${DRY ? ' (dry-run)' : ''}`);

let ingested = 0, dup = 0, failed = 0, skipped = 0;
// oldest-first so, if a run is truncated, the newest stay pending for next time.
for (const id of freshIds.slice().reverse()) {
  let item;
  try {
    const detail = await apiGet(`/${id}`);
    item = renderArticle(detail);
  } catch (e) {
    failed++; console.error(`  ✗ fetch ${id}: ${e.message}`); continue;
  }
  if (!item) { skipped++; seen.add(String(id)); continue; }
  if (DRY) { log(`  • [${item.source}] ${item.title}`); seen.add(String(id)); continue; }
  try {
    const r = await postIngest(item);
    if (r.ingested) ingested++; else dup++;
    seen.add(String(id));
  } catch (e) {
    failed++; console.error(`  ✗ ingest ${id}: ${e.message}`);
  }
  await new Promise(r => setTimeout(r, 150));
}

if (!DRY) {
  state.seen_ids = [...seen].slice(-4000);
  state.last_run = new Date().toISOString();
  state.total_ingested = (state.total_ingested || 0) + ingested;
  fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2), { mode: 0o600 });
}

console.error(`done — ingested ${ingested}, already-known ${dup}, unrenderable ${skipped}, failed ${failed}, pages ${page}`);
