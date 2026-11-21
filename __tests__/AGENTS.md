# Tests

Jest + ts-jest + `@vue/vue3-jest` on jsdom. Run from the repo root:

```bash
npm run test              # whole suite (~5s)
npm run test:watch
npm run test:coverage
npx jest __tests__/utils/deck.test.ts     # one file
npx jest -t "name of test"                # one test
```

Tests live here mirroring the source tree, and **CI runs them before every deploy**
(`.github/workflows/deploy.yml`) — a red suite blocks the Worker from shipping.

## Toolchain notes

`~/` and `@/` resolve to repo root (see `jest.config.js` `moduleNameMapper`). **`motion-v` is ESM and is mocked entirely** rather than transformed: `moduleNameMapper` points `motion-v` at `__tests__/mocks/motion-v.ts`, which renders `motion.*` as passthrough divs (cached per tag for stable component identity) and exposes `__setManualAnimations` / `__resolveAnimations` so tests can assert behavior mid-flight. Mock network calls rather than hitting live feeds; Nuxt auto-imported composables don't exist under Jest, so component tests provide them as `globalThis` stubs.

## Suites

Suites mirror the source tree: `__tests__/utils/` covers `utils/`, `__tests__/server/` covers
`server/utils/` and the email Worker, `__tests__/server/routes/` covers route handlers,
`__tests__/components/` covers components and pages.

**Route-handler tests** import `__tests__/mocks/nitro.ts` first: it installs the real h3
functions Nitro auto-imports (`defineEventHandler`, `createError`, `readBody`, …) as globals and
offers `makeEvent`, a fake D1 (records every statement, rejects more than 100 bound parameters
like D1 does), a fake R2 bucket and `mockFetch`, which fails the test on any request it was not
told to answer — so no test reaches a live service. Those files start with
`/** @jest-environment node */` (the default jsdom environment has no `fetch`/`Response`).
`server/utils/feedParser.ts` does not load under Jest (its parser's dependencies are ESM-only),
so a route that subscribes to a feed stubs `~/server/utils/addFeed` with `jest.mock`.
The seam contracts — the login routes and `session_token` cookie, SFL, taste-maker, `/api/ingest`,
`/api/articles/manual` and `fetch-fulltext` — are pinned there with hand-written responses.
`ls __tests__/*/` gives the current set; each file's `describe` blocks say what it pins down.
