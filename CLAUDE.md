# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**The Reader** — a calm, self-hosted RSS reader built with Nuxt 3, Vue 3, and Cloudflare (Workers + D1 + R2). The entrance is a swipeable **card deck** of unread articles (one card, five verbs); supporting rooms are the **shelf** (saved articles) and **sources** (feed management). The whole surface is styled in the **Tufte Viz design system** (warm paper, ET Book serif, hairline rules, one crimson accent per screen). Deployed at `reader.phareim.no`.

## Where things are documented

This file is the **map**. Detailed docs live next to the code they describe, so they
load only when you are actually working there.

| You are working on | Read |
|---|---|
| API routes, auth, D1/R2, feed sync, full-text, rigs, Discover crawl | [`server/CLAUDE.md`](server/CLAUDE.md) |
| Tufte primitives, card deck, grid, styling, design system | [`components/CLAUDE.md`](components/CLAUDE.md) |
| The four rooms, the reader, keyboard shortcuts | [`pages/CLAUDE.md`](pages/CLAUDE.md) |
| Pure logic: gestures, pagination, sanitization, chunking | [`utils/CLAUDE.md`](utils/CLAUDE.md) |
| Sleeper-side collectors, systemd timers, candidate miners | [`scripts/CLAUDE.md`](scripts/CLAUDE.md) |
| Writing or fixing a test | [`__tests__/CLAUDE.md`](__tests__/CLAUDE.md) |
| Composables (global state vs per-instance surfaces) | [`composables/CLAUDE.md`](composables/CLAUDE.md) |
| The state model + D1 schema | [`docs/architecture/state-model.md`](docs/architecture/state-model.md) |
| SFL, taste-maker, read-aloud | [`docs/architecture/integrations.md`](docs/architecture/integrations.md) |
| MCP server for Claude Desktop | [`docs/architecture/mcp-server.md`](docs/architecture/mcp-server.md) |
| Adding a per-feed rig | the **`feed-rigs`** skill (`.claude/skills/feed-rigs/`) |

Design + feature specs: [`docs/found-feed.md`](docs/found-feed.md),
[`docs/found-feed-ai-digest.md`](docs/found-feed-ai-digest.md),
[`docs/email-ingest.md`](docs/email-ingest.md), `docs/superpowers/{specs,plans}/`.

**When you change a subsystem, update the doc beside it** — not this file. This file
only changes when a whole area is added, moved, or removed.

## Development Commands

```bash
# Start development server (runs on http://localhost:3000 or 3001 if 3000 is taken)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# MCP server for Claude Desktop
npm run mcp

# Tests (Jest + ts-jest + @vue/vue3-jest, jsdom) — CI runs these before every deploy
npm run test
npm run test:watch
npm run test:coverage

# Run a single test file / pattern
npx jest __tests__/utils/deck.test.ts
npx jest -t "name of test"
```

Tests mirror the source tree under `__tests__/`. Suite inventory and the Jest
toolchain gotchas (the `motion-v` mock, the `linkedom/worker` mapping) are in
[`__tests__/CLAUDE.md`](__tests__/CLAUDE.md).

## Tech Stack

- **Frontend**: Nuxt 3 (Vue 3) with auto-imported components and composables
- **Styling**: Tailwind CSS themed by the **Tufte Viz design system** (see [`components/CLAUDE.md`](components/CLAUDE.md)), `@tailwindcss/typography` for reader prose
- **Animation**: `motion-v` (Motion for Vue) — drag physics, springs, and flings on the card deck
- **Backend**: Nitro server routes (REST-style API)
- **Database**: Cloudflare D1 (binding `DB`)
- **Storage**: Cloudflare R2 for article content (binding `ARTICLE_BUCKET`)
- **Auth**: Email/password with PBKDF2 hashing + cookie sessions (zero deps)
- **Feed Parsing**: `@extractus/feed-extractor` for RSS/Atom feeds (NOT rss-parser — that name is historical)
- **Content Sanitization**: isomorphic-dompurify via `utils/processArticleContent.ts`
- **Knowledge pipeline**: swipe-up "elevate" sends an article into the SFL idea tracker (see [`docs/architecture/integrations.md`](docs/architecture/integrations.md))

## Removed surfaces (2026-06 rebuild)

The AI features were torn out with the UX rebuild: newsletter-style summaries (`/api/articles/summarize`), per-tag summaries (`/api/tags/:name/summary`), the one-shot `/api/claude` endpoint, and the Unsplash fallback image endpoint are all **gone**. `OPENAI_API_KEY` and `ANTHROPIC_API_KEY` are no longer needed, and the Worker has no `AI` binding. Legacy article rows may still carry Unsplash filler image URLs from the old feed parser — `utils/cardData.ts` (`cardImageUrl`) filters them client-side; never show them. (Full-text fetch also replaces filler/missing `image_url` server-side with the page's og:image when it runs — see "Full-text fetching" in [`server/CLAUDE.md`](server/CLAUDE.md).)

## Environment Variables

No auth-specific env vars required — sessions use the D1 database directly. Copy `.env.example` → `.env.local`.

```bash
# Feed parsing (optional)
FETCH_TIMEOUT=30000
MAX_ARTICLES_PER_FEED=200

# SFL elevate (swipe-up). Fails soft (503 + toast) if unset.
NUXT_SFL_API_URL="https://sfl-api.aiwdm.workers.dev"
NUXT_SFL_API_KEY="..."

# Read aloud (the "Listen" button). Fails soft (503 + toast) if unset.
NUXT_TTS_API_URL="https://sleeper.phareim.no/reader-tts"
NUXT_TTS_API_KEY="..."

# Sign-up gate: required invite code (sign-up is closed while unset)
NUXT_INVITE_CODE="..."

# Personal integrations (SFL elevate, highlight mirror, read-aloud) — comma list
NUXT_PERSONAL_EMAILS="phareim@gmail.com"

# Background sync: Bearer key for POST /api/internal/sync-{stale,sources}
NUXT_CRON_KEY="..."

# Email ingest: Bearer key for POST /api/internal/email-ingest — must equal
# EMAIL_INGEST_KEY on the reader-email Worker (email-worker/). A copy lives
# in ~/.config/reader/env as READER_EMAIL_INGEST_KEY.
NUXT_EMAIL_INGEST_KEY="..."

# Linked sources (Sources page) + Worker-side Found syncs. Each pair fails
# soft (that source's row is hidden) while unset; HN needs no credentials.
# Redirect URIs https://<host>/api/auth/{x,reddit}/callback must be
# registered on the respective apps.
NUXT_X_CLIENT_ID="..."
NUXT_X_CLIENT_SECRET="..."
NUXT_REDDIT_CLIENT_ID="..."
NUXT_REDDIT_CLIENT_SECRET="..."
```

In production, `NUXT_SFL_API_URL`, `NUXT_TTS_API_URL`, `NUXT_PERSONAL_EMAILS`, `NUXT_X_CLIENT_ID`, and `NUXT_REDDIT_CLIENT_ID` are set in `wrangler.toml` `[vars]`; `NUXT_SFL_API_KEY`, `NUXT_TTS_API_KEY`, `NUXT_INVITE_CODE`, `NUXT_CRON_KEY`, `NUXT_X_CLIENT_SECRET`, and `NUXT_REDDIT_CLIENT_SECRET` are Worker secrets (`wrangler secret put …`). The old `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` are no longer used by anything.

## Deployment

Deployed as a Cloudflare Worker (SSR via Nitro `cloudflare-module` preset) at `reader.phareim.no`. Config in `wrangler.toml` — bindings: `DB` (D1 `reader-service`, `migrations_dir = "database/migrations"`), `ARTICLE_BUCKET` (R2 `reader-articles`). CI in `.github/workflows/deploy.yml` runs **`npm test`** (the gate — a red suite ships nothing, not even the migrations), then `npm run build`, then **`wrangler d1 migrations apply reader-service --remote`**, then `wrangler deploy` on every push to `main` (needs `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` secrets). **Schema changes = a new numbered file in `database/migrations/`** (keep the `NNN-name.sql` convention; also mirror the change into `database/d1-schema.sql` for fresh installs) — commit it and CI applies it before the Worker ships. Applied migrations are tracked in the `d1_migrations` table (`wrangler d1 migrations list reader-service --remote` shows what's pending); the manually-applied history 003–018 was backfilled into it 2026-07-21, so never re-apply those by hand. Local dev DB: `wrangler d1 migrations apply reader-service --local`.

Two Workers **secrets** must exist: `npx wrangler secret put NUXT_SFL_API_KEY` (the SFL API key, for elevate) and `npx wrangler secret put NUXT_TTS_API_KEY` (the `READER_TTS_KEY` from `~/.config/reader-tts/env` on Sleeper, for read-aloud). The matching URLs (`NUXT_SFL_API_URL`, `NUXT_TTS_API_URL`) ship in `wrangler.toml` `[vars]`. Without a secret, that feature returns 503 and everything else works.

**PWA / service worker** (`@vite-pwa/nuxt` in `nuxt.config.ts`): `registerType: 'prompt'` — a new SW waits until the user taps Reload in `PwaUpdatePrompt.vue` (which is built for prompt mode), so a deploy never yanks the running build's chunks out of the precache mid-session. The precached app shell `'/'` is stamped with a **per-build revision** (`buildRevision` at the top of `nuxt.config.ts`); never set it back to `revision: null` — Workbox then pins the first-ever cached shell forever while each deploy purges the hashed `_nuxt/*` chunks it references, and the app boots a shell pointing at 404'd JS and goes dead (bit us 2026-07-02, felt like "the app is unresponsive"). Workbox tests `runtimeCaching` regexes against the **full URL**, so path-anchored `/^\/api\/…/` patterns silently never match — the API routes use `({ url }) => url.pathname.startsWith(…)` functions instead (NetworkFirst, 5s network timeout, for offline reads). Recovery for a device stuck on a dead shell: open the app once so the fixed SW installs in the background, force-quit, reopen (worst case: Safari → Settings → clear website data for the domain and re-add the PWA).

## Coding Style

2-space indentation, TypeScript everywhere Nuxt allows (`<script setup lang="ts">`).
Vue components are PascalCase, composables use the `useX` prefix, and server handlers
carry the HTTP verb as a suffix (`feeds/[id].post.ts`). Prefer the Tufte token
utilities from `tailwind.config.js` over ad-hoc CSS, and small focused files over
large multi-purpose ones. Never commit secrets — copy `.env.example` → `.env.local`.

Commit subjects are short, present-tense, and describe the behaviour change
("Fix BottomBar detaching during fast scrolls on the list rooms"). Keep a schema
change and its migration in one commit.

## Common Development Patterns

**Adding a new composable**: Create in `composables/` directory. Will be auto-imported. Use `useState` for global reactive state; use plain refs for a per-instance surface owned by one mounted component. See [`composables/CLAUDE.md`](composables/CLAUDE.md) for the distinction.

**Adding a new API route**: Create in `server/api/` following the existing pattern. Use `defineEventHandler`, `getAuthenticatedUser`, and return typed responses.

**Adding a new component**: Create in `components/` or subdirectory. Will be auto-imported (`components/tufte/` without prefix). Use `<script setup>` with TypeScript. Compose the Tufte primitives rather than re-inventing labels/buttons/rules.

**Modifying database schema**:
1. Update `database/d1-schema.sql`
2. Apply via `wrangler d1 execute reader-service --file=database/d1-schema.sql` (add a numbered file under `database/migrations/` for incremental changes)

