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
`server/utils/` and the email Worker, `__tests__/components/` covers components and pages.
`ls __tests__/*/` gives the current set; each file's `describe` blocks say what it pins down.
