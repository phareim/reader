# Outbound integrations

Reader writes to three external systems and reads from one voice service. All four
**fail soft**: unset config means that feature 503s or silently skips, and everything
else keeps working.

| Integration | Direction | Config | Failure mode |
|---|---|---|---|
| SFL — elevate | Reader → SFL | `NUXT_SFL_API_URL` + `NUXT_SFL_API_KEY` | 503 + toast, card springs back |
| SFL — highlights | Reader → SFL | same | mark stored locally, `sfl_idea_id = NULL` |
| taste-maker | Reader → taste | `NUXT_TASTE_API_URL` + `NUXT_TASTE_INGEST_KEY` | silent skip, `taste_item_id = NULL` |
| Read aloud (TTS) | Reader → Sleeper → NVIDIA/OpenAI | `NUXT_TTS_API_URL` + `NUXT_TTS_API_KEY` | 503, button fails soft |

## Elevate to SFL

The swipe-up verb promotes an article into the SFL idea tracker (sfl.hareim.no), which the wider knowledge pipeline (sleeper-articles → thoughts/wiki) polls downstream.

- **Server client**: `server/utils/sfl.ts` — `createPageIdea` / `deleteIdea` against `${NUXT_SFL_API_URL}/api/ideas` with Bearer auth, 10s timeouts, response-shape validation. SFL **dedupes page ideas by URL**: POSTing an existing URL returns `{ existing: true, idea }` instead of creating.
- **Route contract**: `POST /api/articles/:id/elevate` creates the SFL idea, then marks the article read (mirroring `read.patch.ts`) **and records the idea id in `Article.sfl_idea_id` — but only when it created the idea (`!existing`); a pre-existing idea is stored as NULL, since it is not ours to delete**; if the local DB write fails it compensates by deleting the idea it just created (only when `!existing`). Returns `{ success, ideaId, existing }`. `DELETE /api/articles/:id/elevate` takes **no body or params** — it reads `Article.sfl_idea_id` back (scoped to the caller's own article) and deletes that idea, so the delete never trusts a client-supplied id (mirrors `Highlight.sfl_idea_id`; a DELETE body would crash the Worker anyway, as Nitro's cloudflare-module entry only buffers post/put/patch). Present ⇒ ours to delete, so undo needs no `existing` flag. Then marks the article unread and clears the column. (The client's `unElevate` still sends `?ideaId=&existing=` for backward-compat; the server ignores them.)
- **Client semantics**: elevate is **non-optimistic** — `CardStack` holds the card mid-air while SFL answers and springs it back on failure ("Could not reach SFL — card kept"). The deck history entry records `ideaId` + `ideaExisting` so undo can reverse correctly.
- **Config**: `NUXT_SFL_API_URL` (set in `wrangler.toml` `[vars]` for prod, `.env.local` for dev) and `NUXT_SFL_API_KEY` (dev: `.env.local`; prod: `wrangler secret put NUXT_SFL_API_KEY`). When either is missing the endpoints 503 ("SFL is not configured") and the UI fails soft.

## Highlights → SFL

The yellow-pen verb saves a *specific passage* (not the whole article) to SFL as a self-contained `quote` idea. Shares the SFL config above.

- **Anchoring**: a highlight is stored as plain-text `start_offset`/`end_offset` into the rendered article's `textContent` (the processed `sanitizedContent` is deterministic) plus the exact `quote` string. `utils/highlightDom.ts` (pure, jsdom-tested) does the DOM work: `getSelectionOffsets` (selection → offsets), `paintHighlight` (wrap the range in `<mark class="hl" data-hl-id>`, splitting across element boundaries; falls back to `textContent.indexOf(quote)` when offsets drift after the full-text re-render), `unpaint`, `clearHighlights`.
- **Hashtags**: `#words` in the note become **real SFL tags**. `utils/hashtags.ts` (pure, shared client+server): `extractHashtags` (unicode-aware, deduped, lowercased) and `renderNoteHtml` (escape + wrap `#tag` in an accent span for the popover). The `#word` also stays visible in the note text.
- **Server client** (`server/utils/sfl.ts`, alongside the elevate helpers): `createQuoteIdea` posts `{ type:'quote', title:<quote≤120>, summary:note, data:{ text, note, source_url, source_title } }` with **no `url`** (quote dedup is url-scoped; we want many quotes per article). `findOrCreateTag` (GET `/api/tags` match-by-title, else POST a `type:'tag'` idea) + `tagIdea` (POST `/api/connections` `label:'tagged_with'`, swallows the 400 "already exists") mirror the canonical `~/sfl-hook` convention. Both are **best-effort** — a tag failure never fails the highlight.
- **Route contract**: `POST /api/articles/:id/highlights` creates the quote idea, promotes hashtags to tags, then inserts the local `Highlight` row. **Fails soft**: if `getSflConfig` 503s (SFL unconfigured) the mark is still stored locally with `sfl_idea_id = NULL`; any *other* SFL error (network/timeout) is surfaced. `DELETE /api/highlights/:id` (id in path — no DELETE body, per the Workers entry) deletes the local row and the SFL idea when one exists.
- **Client semantics**: **non-optimistic** — the page awaits the server id before painting the mark (`saveHighlight` in `pages/article/[id].vue`). Independent of the shelf and does **not** mark the article read.

## Highlights → taste-maker

Personal-account highlights are ALSO mirrored one-way into **taste-maker** (`taste.phareim.no`, `~/github/taste-maker`) as `quote` items — encounter in Reader, refine there. Runs **after** the local row insert (the row id is the idempotency key `reader-highlight:<id>`; taste-maker dedupes on it, so re-sends are harmless).

- **Server client** (`server/utils/taste.ts`): `createQuoteItem` POSTs `{highlight_id, quote, note, source_url, source_title}` to `/api/ingest/highlight`; `deleteQuoteItem` sends the undo, which taste-maker honors only while the item is untouched (no refine wins/losses, no connections). Unlike the SFL mirror, this is **fully best-effort** — never surfaces an error; `Highlight.taste_item_id` (migration `015`) is NULL on a miss.
- **Backfill/repair**: `node scripts/taste-highlight-backfill.mjs` (from this repo on a wrangler-authed host; `--dry-run`/`--force`) mirrors all rows with NULL `taste_item_id` and writes the ids back. First run 2026-07-14: 11/11.
- **Config**: `NUXT_TASTE_API_URL` (wrangler `[vars]`, `https://taste.phareim.no`) + `NUXT_TASTE_INGEST_KEY` (Worker secret = taste-maker's `TASTE_INGEST_KEY`; host copy in `~/.config/taste/env`). Unset ⇒ the mirror silently skips; everything else works.

## Read aloud (TTS)

The "Listen" button at the top of the reader (`pages/article/[id].vue`, key `l`) speaks the article — NVIDIA's hosted **Magpie TTS Multilingual** voice by default, **OpenAI `gpt-4o-mini-tts`** for Norwegian (Magpie speaks 9 languages, none Scandinavian).

- **Chain**: browser → `POST /api/tts` (Worker, session/MCP auth) → `reader-tts` on Sleeper (Bearer `NUXT_TTS_API_KEY`) → NVIDIA gRPC (`grpc.nvcf.nvidia.com:443`, free-tier NIM) or OpenAI → audio back down (`audio/wav` from Magpie, `audio/mpeg` from OpenAI; the Worker passes the upstream Content-Type through). The Worker can't speak gRPC, hence the Sleeper hop.
- **Language routing** (server-side in `tts/server.py`, per chunk): æ/ø/å in the text, a Norwegian-stopword ratio ≥ 0.15, or an explicit `language_code` of `no/nb/nn/da/sv` → OpenAI (~$0.015/min of audio); everything else → Magpie (free). ä/ö deliberately don't trigger it — they'd misroute German, which Magpie speaks natively. Without `OPENAI_API_KEY` everything falls back to Magpie.
- **`reader-tts` service** (`tts/` in this repo, Sleeper-only like the collectors): Python/Flask + `nvidia-riva-client`, PM2 name `reader-tts`, port 3015, proxied at `sleeper.phareim.no/reader-tts/`. Env at `~/.config/reader-tts/env` (`NVIDIA_API_KEY`, `READER_TTS_KEY`, optional `OPENAI_API_KEY`/`OPENAI_TTS_MODEL`/`OPENAI_TTS_VOICE`, loaded with override semantics). `GET /health` is open (reports `norwegian_backend`); `POST /synthesize` needs the Bearer. See `tts/README.md`.
- **Client semantics**: the body is spoken in sentence-boundary chunks (`chunkTextForTts`, ≤1100 chars) — chunk 0 plays as soon as it lands while chunk 1 prefetches, so time-to-first-word stays a second or two. One reused `<audio>` element keeps iOS's gesture unlock valid across chunks; a `ttsToken` counter invalidates the in-flight session on stop/skip/unmount so a stale `onended` can't restart playback. The chunk text is taken from the **article element's `textContent`** (not `stripHtml`) so `locateChunks` (`utils/tts.ts`) can map each chunk to exact character offsets; failures toast and reset ("Could not reach the reading voice").
- **Player + follow view**: while the voice speaks, a fixed bottom bar carries the controls — Back/Next skip a passage, an accent Pause/Resume, Stop, a `— READING i/n` counter, and a hairline rail filling with char-weighted overall progress (per-chunk fraction via `timeupdate`). The **currently-spoken passage** gets a faint crimson wash in the body (`::highlight(tts-reading)` in `main.css`, `--accent-wash`) painted via the CSS Custom Highlight API over a Range from `rangeForOffsets` (`utils/highlightDom.ts`) — no DOM mutation, so the yellow-pen `<mark>`s are never disturbed; browsers without the API just skip the wash. The view gently auto-scrolls when a new passage's top drifts out of the reading band. The **Media Session API** mirrors play/pause/stop/prev/next onto the lock screen (the iOS PWA case), and the audio element's own `pause`/`play` events keep the state honest when the OS pauses it directly. Keys while active: space pause/resume, ←/→ skip a passage, Esc stops (before it would navigate back); the top button still cycles Listen → Voice… → Stop.
- **Config**: `NUXT_TTS_API_URL` (wrangler `[vars]`, `https://sleeper.phareim.no/reader-tts`) + `NUXT_TTS_API_KEY` (Worker secret = `READER_TTS_KEY` on Sleeper). Unset ⇒ `/api/tts` 503s and the button fails soft; everything else works.
