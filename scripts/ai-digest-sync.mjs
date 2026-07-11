#!/usr/bin/env node
/**
 * ai-digest-sync.mjs — Sleeper-side collector: the morning AI digest → Reader "Found" feed.
 *
 * The sixth Found collector (siblings: x / bluesky / mastodon / reddit / instapaper),
 * with one twist: where those normalize *one social item → one card*, this one reads
 * *many SFL ideas → synthesizes → posts ONE card*. Each run:
 *   1. pulls the last ~24h of SFL ideas tagged `ai-news`
 *      (GET /api/ideas?tag=ai-news — the recurring AI-discovery job already drops
 *       these; we read the TAG, not the producer, so the job can evolve underneath us),
 *   2. asks an LLM for a short, calm editor's-letter digest (HTML fragment) —
 *      Venice.ai's OpenAI-compatible API, model glm by default,
 *   3. POSTs it to the Reader's generic /api/ingest seam as source=ai-digest,
 *      with externalId=<date> so the guid `ai-digest:YYYY-MM-DD` is idempotent per day.
 *
 * Empty window → post nothing (silence is the calm default). Claude failure →
 * a deterministic linked-list fallback still lands, so a model outage never
 * costs you the morning card.
 *
 * Config (files, not env — cron has no shell):
 *   ~/.config/ai-digest/env       SFL_API_URL, SFL_API_KEY, VENICE_API_KEY,
 *                                 optional DIGEST_MODEL (default zai-org-glm-5-2),
 *                                 VENICE_API_URL, DIGEST_WINDOW_HOURS
 *   ~/.config/ai-digest/state.json { last_run, last_date, total_posted }
 *   ~/.config/reader/env          READER_API_URL, READER_MCP_TOKEN
 *
 * Flags:
 *   --dry-run         fetch + synthesize + print the HTML, do NOT POST
 *   --verbose         log the window, items, token usage (implied by --dry-run)
 *   --window-hours N  override the look-back window (default 26)
 *   --date YYYY-MM-DD rebuild for a specific day (testing / backfill)
 *   --replace         overwrite an already-posted digest for the day in place
 *                     (same guid; the card returns to unread)
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const HOME = os.homedir();
const ACFG = path.join(HOME, '.config', 'ai-digest');
const STATE_PATH = path.join(ACFG, 'state.json');

const args = process.argv.slice(2);
const DRY = args.includes('--dry-run');
const REPLACE = args.includes('--replace');
const VERBOSE = args.includes('--verbose') || DRY;

function numFlag(name, dflt) {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? Number(args[i + 1]) : dflt;
}
function strFlag(name, dflt) {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : dflt;
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

const SFL_URL = (aenv.SFL_API_URL || '').replace(/\/$/, '');
const SFL_KEY = aenv.SFL_API_KEY;
if (!SFL_URL || !SFL_KEY) throw new Error('missing SFL_API_URL / SFL_API_KEY in ~/.config/ai-digest/env');

// Venice.ai — OpenAI-compatible chat completions. Key falls back to the shell's
// VENICE_API_TOKEN / VENICE_AI_API_KEY for interactive runs, but the systemd
// timer relies on ~/.config/ai-digest/env carrying VENICE_API_KEY.
const VENICE_KEY = aenv.VENICE_API_KEY || process.env.VENICE_API_TOKEN || process.env.VENICE_AI_API_KEY;
const VENICE_URL = (aenv.VENICE_API_URL || 'https://api.venice.ai/api/v1/chat/completions').replace(/\/$/, '');
const MODEL = aenv.DIGEST_MODEL || 'zai-org-glm-5-2';
const WINDOW_HOURS = numFlag('--window-hours', Number(aenv.DIGEST_WINDOW_HOURS) || 26);
const TAG = 'ai-news';

// --- the digest date (local) drives the per-day guid ---
const dateArg = strFlag('--date', null);
const now = new Date();
const digestDate = dateArg || localDate(now);  // YYYY-MM-DD

function localDate(d) {
  // local Y-M-D, not UTC, so "this morning" matches the wall clock
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function prettyDate(ymd) {
  const [y, m, dd] = ymd.split('-').map(Number);
  const d = new Date(y, m - 1, dd);
  const wd = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()];
  const mon = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][m - 1];
  return `${wd} ${dd} ${mon}`;
}

const esc = s => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const stripTags = s => String(s || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

// Most ai-news ideas are `type:note` with url=null and the source link buried in
// the body ("Source: https://…"). Prefer the column, else the first http(s) URL
// in body/summary, so Claude can link the claim instead of emitting href="#".
function sourceUrl(i) {
  if (i.url) return i.url;
  const m = String(`${i.body || ''}\n${i.summary || ''}`).match(/https?:\/\/[^\s<>"')]+/);
  return m ? m[0] : null;
}

// Models that reason can emit a <think> block or a plain-text planning preamble
// ("Let me analyze…") before the HTML. Strip the think block, drop any code
// fence, then slice from the first real block-level tag so only the fragment ships.
function extractFragment(s) {
  let h = String(s)
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/```html\s*/gi, '').replace(/```/g, '')
    .trim();
  const m = h.match(/<(p|h[1-4]|ul|ol|blockquote)\b/i);
  if (m) h = h.slice(m.index);
  return h.trim();
}

// Safety net: unwrap any link the model invented despite the prompt (href="#",
// empty, fragment-only, or non-http) into plain text, so no dead links ship.
function unwrapDeadLinks(html) {
  return String(html).replace(/<a\b[^>]*\bhref=("|')([^"']*)\1[^>]*>([\s\S]*?)<\/a>/gi,
    (full, _q, href, inner) => /^https?:\/\//i.test(href.trim()) ? full : inner);
}

// --- 1. pull the ai-news window from SFL ---
async function fetchWindow() {
  const res = await fetch(`${SFL_URL}/api/ideas?tag=${encodeURIComponent(TAG)}&limit=80`, {
    headers: { Authorization: `Bearer ${SFL_KEY}` },
  });
  const j = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`sfl ${res.status}: ${JSON.stringify(j).slice(0, 200)}`);
  const ideas = Array.isArray(j?.ideas) ? j.ideas : (Array.isArray(j) ? j : []);

  // `--date` rebuilds the window that ended at the END of that local day; a
  // normal run anchors on "now". created_at is epoch ms.
  const anchorMs = dateArg
    ? new Date(`${digestDate}T23:59:59`).getTime()
    : now.getTime();
  const floorMs = anchorMs - WINDOW_HOURS * 3600_000;

  return ideas
    .filter(i => Number(i.created_at) > floorMs && Number(i.created_at) <= anchorMs)
    .sort((a, b) => Number(b.created_at) - Number(a.created_at));
}

// --- 2. synthesize (Claude via the REST API — no SDK dep, like the other collectors) ---
const SYSTEM_BLOCK = `You write a single calm, declarative morning AI brief for one reader (Petter). \
Voice: scholarly almanac — measured, specific, no hype, no marketing adjectives, no "exciting"/"game-changing". \
You are given the day's AI-news items as JSON. Your job:
- Open with ONE short paragraph naming the single most important thing to know today.
- Group the rest into 2–4 themes with a short <h3> each; under each, a few <li> items.
- Link a claim to its source ONLY using the item's exact url. Never output href="#", a fragment, a placeholder, \
or an invented link; if an item has no url, state the fact with no link at all. Do not name internal project \
codenames or links that are not in the items.
- Drop low-signal, off-topic, or duplicate items rather than padding (the feed is auto-tagged and includes noise). \
If the items are thin, keep it short. Never invent facts beyond what the items state.
Output: a clean HTML FRAGMENT only — <p>, <h3>, <ul>/<li>, <a href> — no <html>/<body> wrapper, no markdown, \
no code fences, no preamble. Links must be <a href="https://…">text</a> using a url from the items.`;

async function synthesize(items) {
  if (!VENICE_KEY) { log('no VENICE_API_KEY — using fallback'); return null; }
  const payloadItems = items.map(i => ({
    title: i.title || '(untitled)',
    text: (stripTags(i.summary) || stripTags(i.body) || '').slice(0, 600),
    url: sourceUrl(i) || undefined,
  }));

  const res = await fetch(VENICE_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${VENICE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 4000,                  // headroom: glm-class models reason before answering
      temperature: 0.4,
      venice_parameters: {
        include_venice_system_prompt: false,   // our system block governs voice
        disable_thinking: true,                // glm is a reasoning model — skip the chain of thought
        strip_thinking_response: true,         // and strip any <think> block server-side
      },
      messages: [
        { role: 'system', content: SYSTEM_BLOCK },
        { role: 'user', content: `Date: ${prettyDate(digestDate)}\nItems:\n${JSON.stringify(payloadItems, null, 2)}` },
      ],
    }),
  });
  const j = await res.json().catch(() => null);
  if (!res.ok) { console.error(`venice ${res.status}: ${JSON.stringify(j).slice(0, 200)}`); return null; }
  log(`venice usage: in=${j?.usage?.prompt_tokens} out=${j?.usage?.completion_tokens} (model ${MODEL})`);
  const raw = (j?.choices?.[0]?.message?.content || '').trim();
  const cleaned = extractFragment(raw);
  return cleaned ? unwrapDeadLinks(cleaned) : null;
}

// deterministic fallback: just the linked list, no prose
function fallbackHtml(items) {
  const lis = items.map(i => {
    const t = esc(i.title || stripTags(i.summary).slice(0, 90) || 'untitled');
    return i.url ? `<li><a href="${esc(i.url)}">${t}</a></li>` : `<li>${t}</li>`;
  }).join('\n');
  return `<p>${items.length} AI item${items.length === 1 ? '' : 's'} from the last ${WINDOW_HOURS}h.</p>\n<ul>\n${lis}\n</ul>`;
}

// --- 3. post the one card ---
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
const items = await fetchWindow();
log(`window: ${items.length} ai-news item(s) in the last ${WINDOW_HOURS}h (anchor ${digestDate})`);
for (const i of items) log(`  • ${i.title || stripTags(i.summary).slice(0, 70)}`);

if (items.length === 0) {
  console.error(`done — nothing in the ${WINDOW_HOURS}h window for ${digestDate}; posted nothing`);
  process.exit(0);
}

let html = await synthesize(items);
if (!html) { log('falling back to linked-list digest'); html = fallbackHtml(items); }

// lead item's url is the card's "view original" target; safe valid-URL fallback
const leadUrl = items.find(i => i.url)?.url || 'https://sfl.hareim.no/';
const summary = stripTags(html).slice(0, 280);

const card = {
  source: 'ai-digest',
  externalId: digestDate,                       // guid `ai-digest:YYYY-MM-DD`, idempotent per day
  url: leadUrl,
  title: `AI digest · ${prettyDate(digestDate)}`,
  content: html,
  summary: summary || undefined,
  publishedAt: now.toISOString(),
  ...(REPLACE ? { replace: true } : {}),
};

if (DRY) {
  console.error(`\n--- DRY RUN: would POST card ---\ntitle: ${card.title}\nurl:   ${card.url}\n`);
  console.log(html);
  process.exit(0);
}

try {
  const r = await postIngest(card);
  const state = fs.existsSync(STATE_PATH) ? JSON.parse(fs.readFileSync(STATE_PATH, 'utf8')) : { total_posted: 0 };
  if (r.ingested) state.total_posted = (state.total_posted || 0) + 1;
  state.last_run = now.toISOString();
  state.last_date = digestDate;
  fs.mkdirSync(ACFG, { recursive: true });
  fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2), { mode: 0o600 });
  console.error(`done — ${r.ingested ? 'posted' : r.replaced ? 'rebuilt' : 'already-present'} AI digest for ${digestDate} (${items.length} items)`);
} catch (e) {
  console.error(`✗ ingest failed: ${e.message}`);
  process.exit(1);
}
