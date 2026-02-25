# Repository Guidelines

## Project Structure & Module Organization
Nuxt 3 pages live under `pages/`, while reusable UI lives in `components/` (grouped by feature) and global state helpers sit in `composables/`. Server endpoints are colocated in `server/api/<domain>/<action>.ts`, sharing helpers in `server/utils/`. Database SQL and functions live in `database/`. Assets such as favicons or mock data belong to `public/` and `assets/`, and TypeScript helpers are in `types/` and `utils/`. Jest specs mirror features inside `__tests__/components` and `__tests__/utils`.

## Build, Test, and Development Commands
- `npm run dev` starts the Nuxt dev server at `http://localhost:3000`.
- `npm run build` produces the Nitro/SSR build; `npm run preview` serves that build for smoke tests.
- `npm run test`, `npm run test:watch`, and `npm run test:coverage` run the Jest suite in different modes.
- `npm run mcp` is available for local MCP-server development; skip it if you are not touching `mcp-server/`.

## Coding Style & Naming Conventions
Use 2-space indentation and TypeScript everywhere Nuxt allows (`<script setup lang="ts">`). Vue components are PascalCase (`components/layout/PageHeader.vue`), composables use the `useX` prefix, and server handlers follow HTTP verb suffices (`feeds/[id].post.ts`). Favor Tailwind utility classes from `tailwind.config.js` instead of ad-hoc CSS, and prefer small, focused files over large multi-purpose modules.

## Testing Guidelines
Jest with `ts-jest`, `@vue/vue3-jest`, and jsdom is configured in `jest.config.js`. Unit and component tests belong in `__tests__/…/*.test.ts`, mirroring the folder you cover (e.g., `components/common/BulkActionBar` → `__tests__/components/BulkActionBar.test.ts`). Target at least the collectors listed in `collectCoverageFrom`, and use `npm run test:coverage` before opening a PR touching core UI or server logic. Mock network calls via composables or server utils instead of hitting live feeds.

## Commit & Pull Request Guidelines
Recent history favors short, descriptive subjects such as `performance improvements` or `Bump glob from 10.4.5 to 10.5.0`; follow that present-tense style and include scope if needed (`feeds: debounce refresh button`). Reference related issues in the body and keep commits logically grouped (e.g., schema change + migration in one commit). PRs should summarize behavior, list verification steps (`npm run test`, screenshots for UI tweaks), and mention any migrations or env changes. Tag reviewers on cross-cutting changes (auth, sync engine, data model).

## Security & Configuration Tips
Copy `.env.example` to `.env.local`, set OAuth/API keys, and never commit secrets. Run `npm install` once per Node 22.x environment so `postinstall` can prepare Nuxt. Before deploying, ensure Cloudflare bindings and env vars are set for the target environment. If handling RSS HTML, rely on the existing DOMPurify utilities in `server/utils/` rather than crafting new sanitizers.
