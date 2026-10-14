# PWA and service worker

`@vite-pwa/nuxt`, configured in `nuxt.config.ts`. Two rules in
[`../../AGENTS.md`](../../AGENTS.md) are load-bearing: `navigateFallback`
stays `null`, and the precached shell never gets `revision: null`. This page
explains why, and the rest of the setup.

## Update flow

`registerType: 'prompt'` — a new SW waits until the user taps Reload in
`PwaUpdatePrompt.vue` (which is built for prompt mode), so a deploy never
yanks the running build's chunks out of the precache mid-session.

## Navigations

**`navigateFallback` must stay `null`.** With `navigateFallback: '/'` the SW
answers every hard navigation (refresh, deep link) with the precached home
shell, whose SSR payload says `path: '/'` — and Nuxt initializes the router
from `payload.path`, so `/comics`, `/shelf`, or `/article/…` render the bare
home deck.

Page navigations are instead a `NetworkFirst` runtimeCaching route
(`request.mode === 'navigate'`, `/api/` excluded so OAuth dances aren't
cached, cache `pages-cache`): online gets the real SSR page, offline serves
the last cached copy of that URL. `'/'` itself stays precached so a cold
offline PWA launch still boots.

## The app shell revision

The precached app shell `'/'` is stamped with a **per-build revision**
(`buildRevision` at the top of `nuxt.config.ts`). Never set it back to
`revision: null`: Workbox then pins the first-ever cached shell forever while
each deploy purges the hashed `_nuxt/*` chunks it references, and the app
boots a shell pointing at 404'd JS and goes dead (to the user it looks like
"the app is unresponsive").

## API caching

Workbox tests `runtimeCaching` regexes against the **full URL**, so
path-anchored `/^\/api\/…/` patterns silently never match. The API routes use
`({ url }) => url.pathname.startsWith(…)` functions instead (NetworkFirst, 5s
network timeout, for offline reads).

## Precache size

The precache entry count depends on the `brace-expansion` + `minimatch`
override pair (see "Dependency pins" in the root AGENTS.md). Check the
`precache N entries` line in build output after touching either.

## Recovering a device stuck on a dead shell

Open the app once so the fixed SW installs in the background, force-quit,
reopen. Worst case: Safari → Settings → clear website data for the domain and
re-add the PWA.
