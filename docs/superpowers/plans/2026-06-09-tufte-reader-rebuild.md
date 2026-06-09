# Tufte Reader Rebuild Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ground-up rebuild of the reader UI in the Tufte Viz design system: a three-room app (Deck / Shelf / Sources) around a motion-v swipeable card deck with five verbs (save / read / elevate-to-SFL / skip / open), with all AI-summary surfaces and Unsplash filler removed.

**Architecture:** The presentation layer (pages, components, gesture code, styling) is torn down and rebuilt; the data layer (D1 schema, auth, feed sync, full-text/R2, saved-articles APIs, MCP server) survives. Pure deck mechanics live in `utils/deck.ts` (TDD), physics in `motion-v`, and a new `POST /api/articles/:id/elevate` route bridges to the SFL API.

**Tech Stack:** Nuxt 3, Vue 3, Tailwind (custom Tufte preset), motion-v 2.x, Cloudflare D1/R2/Workers, Jest + ts-jest + @vue/test-utils.

**Spec:** `docs/superpowers/specs/2026-06-09-tufte-reader-rebuild-design.md`

**Key facts discovered during research (trust these, they were verified):**

- **SFL API**: base `https://sfl-api.aiwdm.workers.dev`. `POST /api/ideas` with `Authorization: Bearer <key>`, body `{type:'page', title, url}` → `201 {idea:{id,...}}`; **dedupes by URL** — if a page idea with the same URL exists it returns `{existing: true, idea: {...}}` instead of creating. `DELETE /api/ideas/:id` → `{deleted: id}` (hard delete, cascades). Undo must therefore **only delete when the create was not `existing`**.
- **motion-v 2.3**: peer dep `@vueuse/core` (already installed). Import `{ motion, useMotionValue, useTransform, animate } from 'motion-v'` per component (the `motion.div` dot-proxy is NOT auto-importable; do not use the Nuxt module — plain imports work and keep Jest simple). Drag props: `drag`, `dragSnapToOrigin` (springs back on release), `dragElastic`, `dragMomentum`. `@dragEnd="(e, info) => ..."` where `info: PanInfo = {offset:{x,y}, velocity:{x,y}, ...}`. Imperative fling: `animate(x, target, {type:'spring', velocity, stiffness, damping})` returns a thenable. SSR-safe out of the box.
- **Existing D1 rows contain Unsplash filler URLs in `Article.image_url`** (the old feed parser fell back to `getRandomUnsplashImage()`). Removing the fallback only fixes future rows — the card must also filter `images.unsplash.com` / `source.unsplash.com` URLs client-side.
- The `Article` TS type in `types/index.ts` is missing `imageUrl` even though `GET /api/articles` returns it (`imageUrl: article.image_url`).
- `useToast()` uses module-local `ref`s (NOT `useState`) — toast state is per-component-tree instance; the new `AppToast` in `app.vue` needs shared state, so Task 1 converts it to `useState`.

---

## Task 1: Tufte visual foundation

**Files:**
- Create: `public/tufte/fonts/` (vendored woffs), `assets/css/tufte.css`, `config/tufte.preset.cjs`
- Create: `components/tufte/MonoLabel.vue`, `components/tufte/ActionLabel.vue`, `components/tufte/HairlineRule.vue`, `components/tufte/CardFrame.vue`, `components/BottomBar.vue`, `components/AppToast.vue`
- Modify: `tailwind.config.js`, `nuxt.config.ts`, `app.vue`, `composables/useToast.ts`

- [ ] **Step 1: Vendor ET Book fonts and license**

```bash
mkdir -p public/tufte/fonts
cp ~/.claude/skills/tufte-viz/assets/fonts/et-book-roman.woff \
   ~/.claude/skills/tufte-viz/assets/fonts/et-book-italic.woff \
   ~/.claude/skills/tufte-viz/assets/fonts/et-book-bold.woff \
   ~/.claude/skills/tufte-viz/assets/fonts/ET-Book-LICENSE.txt \
   public/tufte/fonts/
```

- [ ] **Step 2: Create `assets/css/tufte.css`**

Start from the skill's color tokens, converting the `.tufte-dark` class block to a media query:

```bash
cp ~/.claude/skills/tufte-viz/tokens/colors.css assets/css/tufte.css
```

Then edit `assets/css/tufte.css`:
1. Replace the line `.tufte-dark {` with:
   ```css
   @media (prefers-color-scheme: dark) {
   :root {
   ```
2. Add one extra closing brace `}` at the end of that block (the dark block is the last rule in the file — append `}` at EOF). The dark block in the source file re-declares the semantic aliases (`--text-strong` etc.) inside itself — keep all of them; that re-declaration is what makes the flip work.
3. Prepend the `@font-face` rules at the top of the file:

```css
@font-face {
  font-family: 'et-book';
  src: url('/tufte/fonts/et-book-roman.woff') format('woff');
  font-weight: 400;
  font-style: normal;
  font-display: swap;
}
@font-face {
  font-family: 'et-book';
  src: url('/tufte/fonts/et-book-italic.woff') format('woff');
  font-weight: 400;
  font-style: italic;
  font-display: swap;
}
@font-face {
  font-family: 'et-book';
  src: url('/tufte/fonts/et-book-bold.woff') format('woff');
  font-weight: 700;
  font-style: normal;
  font-display: swap;
}
```

4. Append base element styles at the bottom (after the dark block):

```css
html {
  background: var(--surface-page);
}
body {
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
}
```

- [ ] **Step 3: Create `config/tufte.preset.cjs`**

```js
/* Tufte Viz Tailwind preset — semantic, theme-aware utilities over the
   --tufte-* / semantic CSS variables in assets/css/tufte.css.
   One accent per screen. Hairlines, never boxes. */

module.exports = {
  theme: {
    extend: {
      colors: {
        paper:          'var(--surface-page)',
        'paper-raised': 'var(--surface-card)',
        'paper-sunk':   'var(--surface-sunk)',
        ink:            'var(--text-strong)',
        body:           'var(--text-body)',
        mute:           'var(--text-muted)',
        faint:          'var(--text-faint)',
        accent:         'var(--tufte-accent)',
        'accent-ink':   'var(--text-accent)',
        rule:           'var(--border-rule)',
        'rule-strong':  'var(--border-strong)',
      },
      fontFamily: {
        serif: ['et-book', 'Charter', 'Palatino', 'Georgia', 'serif'],
        mono:  ['SF Mono', 'ui-monospace', 'Menlo', 'Consolas', 'monospace'],
      },
      borderColor: {
        rule: 'var(--border-rule)',
        'rule-strong': 'var(--border-strong)',
      },
      maxWidth: {
        measure: '65ch',
      },
    },
  },
  darkMode: 'media',
}
```

- [ ] **Step 4: Rewrite `tailwind.config.js`**

Replace the whole file (drops the Almanac preset, the `.mono-label` plugin, and retargets prose at the Tufte variables):

```js
/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'media',
  presets: [
    require('./config/tufte.preset.cjs'),
  ],
  content: [
    "./components/**/*.{js,vue,ts}",
    "./layouts/**/*.vue",
    "./pages/**/*.vue",
    "./plugins/**/*.{js,ts}",
    "./app.vue",
  ],
  theme: {
    extend: {
      typography: () => ({
        DEFAULT: {
          css: {
            fontFamily: "'et-book', Charter, Palatino, Georgia, serif",
            color: 'var(--text-body)',
            maxWidth: '65ch',
            fontSize: '1.0625rem',
            lineHeight: '1.6',
            h1: { color: 'var(--text-strong)', fontWeight: '400' },
            h2: { color: 'var(--text-strong)', fontWeight: '400' },
            h3: { color: 'var(--text-strong)', fontWeight: '400' },
            h4: { color: 'var(--text-strong)', fontWeight: '400' },
            strong: { color: 'var(--text-strong)' },
            a: { color: 'var(--text-accent)', textDecorationThickness: '1px', textUnderlineOffset: '2px' },
            blockquote: { color: 'var(--text-muted)', borderLeftColor: 'var(--border-rule)', fontStyle: 'italic' },
            hr: { borderColor: 'var(--border-rule)' },
            code: { color: 'var(--text-strong)', backgroundColor: 'var(--surface-sunk)' },
            pre: { backgroundColor: 'var(--surface-sunk)', color: 'var(--text-body)' },
            img: { filter: 'saturate(.9)' },
            figcaption: { color: 'var(--text-muted)' },
          },
        },
      }),
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
}
```

- [ ] **Step 5: Update `nuxt.config.ts`**

- Change the `css` array to `css: ['~/assets/css/tufte.css', '~/assets/css/main.css']`
- In `app.head.link`, DELETE the two vendored Almanac stylesheet entries (`/almanac/tokens/tokens.css` and `/almanac/components-web/almanac.css`), keep the favicon entries.
- Change `app.head.title` to `'The Reader'` and the description meta to `'A calm reading room'`.
- In `components.dirs`, change the first entry's `path` from `'~/components/almanac'` to `'~/components/tufte'` (still `pathPrefix: false`).

- [ ] **Step 6: Create the four Tufte primitives**

`components/tufte/MonoLabel.vue` — keeps the Almanac component's name/props so surviving pages keep working:

```vue
<template>
  <span
    class="font-mono uppercase text-mute"
    :class="accent ? 'text-accent-ink' : ''"
    style="font-size: 10px; letter-spacing: 0.16em;"
  ><template v-if="dash">&mdash;&nbsp;</template><slot /></span>
</template>

<script setup lang="ts">
defineProps<{
  /** Leading em-dash, the Tufte/Almanac section-label convention. */
  dash?: boolean
  /** Promote to the screen's single accent. */
  accent?: boolean
}>()
</script>
```

`components/tufte/ActionLabel.vue` — the button substitute:

```vue
<template>
  <button
    type="button"
    class="border px-3 py-1.5 font-mono uppercase transition-colors duration-150 select-none"
    :class="accent
      ? 'border-accent text-accent-ink'
      : 'border-rule text-mute hover:border-rule-strong hover:text-ink'"
    style="font-size: 10px; letter-spacing: 0.16em; border-radius: 0;"
    :disabled="disabled"
    @click="emit('click')"
  >&mdash;&nbsp;<slot /></button>
</template>

<script setup lang="ts">
defineProps<{ accent?: boolean; disabled?: boolean }>()
const emit = defineEmits<{ click: [] }>()
</script>
```

`components/tufte/HairlineRule.vue`:

```vue
<template>
  <hr class="border-0 border-t border-rule" :class="strong ? 'border-rule-strong' : ''" />
</template>

<script setup lang="ts">
defineProps<{ strong?: boolean }>()
</script>
```

`components/tufte/CardFrame.vue` — hairline-framed paper, no radius, no shadow:

```vue
<template>
  <div class="border border-rule-strong bg-paper-raised overflow-hidden">
    <slot />
  </div>
</template>
```

- [ ] **Step 7: Convert `useToast` to shared `useState` and create `AppToast`**

In `composables/useToast.ts`, replace the two `ref` declarations:

```ts
  const success = useState<string | null>('toastSuccess', () => null)
  const error = useState<string | null>('toastError', () => null)
```

(also delete the now-unused `import { ref } from 'vue'` line; keep everything else identical — timeouts stay module-local, which is fine since only durations live there).

`components/AppToast.vue`:

```vue
<template>
  <Transition name="toast">
    <div
      v-if="success || error"
      class="fixed bottom-16 left-1/2 -translate-x-1/2 z-50 border bg-paper-raised px-4 py-2"
      :class="error ? 'border-accent' : 'border-rule-strong'"
    >
      <MonoLabel :accent="!!error" dash>{{ success || error }}</MonoLabel>
    </div>
  </Transition>
</template>

<script setup lang="ts">
const { success, error } = useToast()
</script>

<style scoped>
.toast-enter-active, .toast-leave-active { transition: opacity .2s ease, transform .2s ease; }
.toast-enter-from, .toast-leave-to { opacity: 0; transform: translate(-50%, 6px); }
</style>
```

- [ ] **Step 8: Create `components/BottomBar.vue`**

```vue
<template>
  <nav
    v-if="visible"
    class="fixed bottom-0 inset-x-0 z-40 border-t border-rule bg-paper"
    style="padding-bottom: env(safe-area-inset-bottom);"
  >
    <div class="mx-auto max-w-measure flex">
      <NuxtLink
        v-for="room in rooms"
        :key="room.path"
        :to="room.path"
        class="flex-1 py-3 text-center font-mono uppercase"
        style="font-size: 10px; letter-spacing: 0.16em;"
        :class="isActive(room.path) ? 'text-accent-ink' : 'text-mute'"
      >{{ room.label }}</NuxtLink>
    </div>
  </nav>
</template>

<script setup lang="ts">
const route = useRoute()

const rooms = [
  { path: '/', label: 'Deck' },
  { path: '/shelf', label: 'Shelf' },
  { path: '/sources', label: 'Sources' },
]

const visible = computed(() =>
  !route.path.startsWith('/article') && route.path !== '/login'
)

function isActive(path: string) {
  return path === '/' ? route.path === '/' : route.path.startsWith(path)
}
</script>
```

- [ ] **Step 9: Rewrite `app.vue`**

```vue
<template>
  <div class="min-h-screen bg-paper text-ink font-serif">
    <NuxtPage />
    <BottomBar />
    <AppToast />
    <ClientOnly>
      <PwaUpdatePrompt />
    </ClientOnly>
  </div>
</template>
```

(The script block is deleted entirely — dark mode is pure CSS now; the Starfield is gone.)

- [ ] **Step 10: Verify build and commit**

Run: `npm run build`
Expected: build succeeds (old pages still reference Almanac components — auto-import resolution failures are runtime warnings, not build errors; they are deleted next task).

Run: `npx jest`
Expected: PASS (existing suites untouched so far — `deck.test.ts` still imports the old `utils/deck.ts`).

```bash
git add -A
git commit -m "Tufte foundation: ET Book, tokens, preset, primitives, bottom bar"
```

---

## Task 2: Frontend teardown to a skeleton

**Files:**
- Delete: old components, pages, composables, utils, tests, Almanac assets (exact lists below)
- Modify: `pages/index.vue`, `pages/article/[id].vue`, `pages/login.vue`, `pages/mcp-settings.vue`
- Create: `pages/shelf.vue`, `pages/sources.vue` (stubs)

- [ ] **Step 1: Delete the old presentation layer**

```bash
git rm -r components/almanac components/article components/common components/feed \
         components/layout components/menu components/stack
git rm components/SwipeIndicator.vue
git rm pages/saved.vue 'pages/feed/[id].vue' 'pages/tag/[name].vue'
git rm -r pages/test
git rm composables/useClaude.ts composables/useSummarize.ts composables/useSwipeGesture.ts \
       composables/useDeckGesture.ts composables/useArticleNavigation.ts \
       composables/useArticlePageCommon.ts composables/useArticleSearch.ts \
       composables/useArticleViewHandlers.ts composables/useBulkActionHandlers.ts \
       composables/useBulkSelection.ts composables/useSavedArticlesByTag.ts \
       composables/useKeyboardShortcuts.ts composables/useClickOutside.ts
git rm utils/swipeCurve.ts utils/deck.ts
git rm __tests__/utils/swipeCurve.test.ts __tests__/utils/deck.test.ts
git rm -r public/almanac
git rm assets/css/almanac.css config/almanac.preset.cjs
```

(Keep: `components/PwaUpdatePrompt.vue`, `components/tufte/`, `components/BottomBar.vue`, `components/AppToast.vue`, `composables/useArticles.ts`, `useSavedArticles.ts`, `useFeeds.ts`, `useTags.ts`, `useAuth.ts`, `useToast.ts`, `utils/formatDate.ts`, `utils/processArticleContent.ts`, `__tests__/components/BasicComponent.test.ts` — it's self-contained.)

- [ ] **Step 2: Stub the deck and reader pages**

`pages/index.vue` (replaced wholesale; real deck arrives in Task 7):

```vue
<template>
  <main class="flex min-h-screen items-center justify-center pb-16">
    <MonoLabel dash>Deck under construction</MonoLabel>
  </main>
</template>
```

`pages/article/[id].vue` (replaced wholesale; real reader arrives in Task 8):

```vue
<template>
  <main class="mx-auto max-w-measure px-5 py-10">
    <NuxtLink to="/"><MonoLabel dash>Back</MonoLabel></NuxtLink>
  </main>
</template>
```

- [ ] **Step 3: Create the room stubs**

`pages/shelf.vue`:

```vue
<template>
  <main class="mx-auto max-w-measure px-5 py-10 pb-20">
    <MonoLabel dash>Shelf</MonoLabel>
  </main>
</template>
```

`pages/sources.vue`:

```vue
<template>
  <main class="mx-auto max-w-measure px-5 py-10 pb-20">
    <MonoLabel dash>Sources</MonoLabel>
  </main>
</template>
```

- [ ] **Step 4: Rebuild `pages/login.vue` template**

Keep the existing `<script setup>` block **unchanged** (it only uses `useAuth` + local refs). Replace the `<template>` and `<style>` blocks with:

```vue
<template>
  <main class="flex min-h-screen items-center justify-center px-5">
    <div class="w-full max-w-sm">
      <MonoLabel dash>The Reader</MonoLabel>
      <h1 class="mt-2 text-3xl">{{ isSignUp ? 'Create account' : 'Sign in' }}</h1>
      <HairlineRule class="mt-4 mb-6" />

      <form @submit.prevent="handleSubmit" class="space-y-5">
        <div v-if="isSignUp">
          <MonoLabel>Name</MonoLabel>
          <input v-model="name" type="text" autocomplete="name" class="tufte-input" />
        </div>
        <div>
          <MonoLabel>Email</MonoLabel>
          <input v-model="email" type="email" required autocomplete="email" class="tufte-input" />
        </div>
        <div>
          <MonoLabel>Password</MonoLabel>
          <input
            v-model="password" type="password" required
            :autocomplete="isSignUp ? 'new-password' : 'current-password'" class="tufte-input"
          />
        </div>

        <p v-if="error" class="text-sm text-accent-ink">{{ error }}</p>

        <div class="flex items-center justify-between pt-2">
          <ActionLabel accent :disabled="loading" @click="handleSubmit">
            {{ loading ? 'Working…' : isSignUp ? 'Sign up' : 'Sign in' }}
          </ActionLabel>
          <button type="button" class="font-mono uppercase text-mute"
            style="font-size: 10px; letter-spacing: 0.16em;"
            @click="isSignUp = !isSignUp">
            {{ isSignUp ? 'Have an account?' : 'New here?' }}
          </button>
        </div>
      </form>
    </div>
  </main>
</template>
```

```vue
<style scoped>
.tufte-input {
  width: 100%;
  background: transparent;
  border: 0;
  border-bottom: 1px solid var(--border-rule);
  color: var(--text-strong);
  font-family: 'et-book', Charter, Georgia, serif;
  font-size: 16px;
  line-height: 1.55;
  padding: 6px 0;
  outline: none;
}
.tufte-input:focus { border-bottom-color: var(--tufte-accent); }
</style>
```

- [ ] **Step 5: Mechanically reskin `pages/mcp-settings.vue`**

Keep its `<script setup>` **unchanged**. In the `<template>`, apply these mechanical replacements (the page's structure and logic stay identical):

| Old tag | Replacement |
|---|---|
| `<SerifHeadline ...>X</SerifHeadline>` | `<h2 class="text-2xl">X</h2>` (use `text-3xl` for the page title at the top) |
| `<HeaderDivider ... />` / `<SectionDivider ... />` | `<HairlineRule />` |
| `<OrbitalGlyph ... />`, `<Starfield ... />` | delete the element |
| `<MonoLabel>` / `<ActionLabel>` | keep — the Tufte versions are name- and prop-compatible |

Also delete any `<style scoped>` rules referencing `--almanac-*` variables, replacing variable references with the Tufte equivalents (`--almanac-rule-line` → `--border-rule`, `--almanac-fg` → `--text-strong`, `--almanac-fg-mute` → `--text-muted`, `--almanac-accent` → `--tufte-accent`, `--almanac-serif` → `'et-book', Georgia, serif`).

- [ ] **Step 6: Sweep for stragglers**

Run: `grep -rn "almanac\|Starfield\|OrbitalGlyph\|SerifHeadline\|SectionDivider\|HeaderDivider\|useDeckGesture\|useSwipeGesture\|mono-label" pages components composables app.vue assets nuxt.config.ts tailwind.config.js --include='*.vue' --include='*.ts' --include='*.css' --include='*.js'`
Expected: no matches (fix any that appear).

- [ ] **Step 7: Verify and commit**

Run: `npm run build && npx jest`
Expected: build PASS, tests PASS (BasicComponent only).

```bash
git add -A
git commit -m "Tear down old presentation layer to a Tufte skeleton"
```

---

## Task 3: Backend teardown + dependency hygiene

**Files:**
- Delete: AI + Unsplash routes/utils/types (list below)
- Modify: `server/utils/feedParser.ts`, `types/index.ts`, `wrangler.toml`, `package.json`, `.env.example`

- [ ] **Step 1: Delete AI and Unsplash surfaces**

```bash
git rm server/api/articles/summarize.post.ts \
       'server/api/tags/[name]/summary.post.ts' \
       server/api/claude.post.ts \
       server/api/unsplash/random.get.ts \
       server/utils/summarization.ts \
       server/utils/tag-summary.ts \
       server/utils/unsplash.ts \
       types/summarization.ts
```

- [ ] **Step 2: Remove the summarization re-export from `types/index.ts`**

Delete the trailing block:

```ts
// Summarization types
export type {
  SummarizeRequest,
  SummarizeResponse,
  SummarizeMetadata,
  ArticleForSummary
} from './summarization'
```

And add `imageUrl` to the `Article` interface (it is already returned by the API):

```ts
  imageUrl?: string | null
```

(place it after `summary?: string | null`).

- [ ] **Step 3: Remove the Unsplash fallback from `server/utils/feedParser.ts`**

- Delete line 2: `import { getRandomUnsplashImage } from './unsplash'`
- In `extractImageUrl(...)`, delete the fallback block:

```ts
  // 5. Fallback to Unsplash random image
  const unsplashImage = await getRandomUnsplashImage()
  if (unsplashImage) {
    return unsplashImage
  }
```

- Update the function's doc comment (remove the "Falls back to Unsplash" line).
- Run `grep -n unsplash server/ -ri` — fix any remaining reference (the favicon path may also call it; a feed with no favicon should yield `faviconUrl: ''` or the site's `/favicon.ico` guess, never a stock photo).

- [ ] **Step 4: Remove the `AI` binding and AI helper**

- In `wrangler.toml`, delete the `[ai]` / `binding = "AI"` block.
- In `server/utils/cloudflare.ts`, delete the `getAI()` export (grep first: `grep -rn getAI server/` — it should now be unused).

- [ ] **Step 5: Remove dead dependencies and audit**

```bash
npm uninstall openai @anthropic-ai/sdk
grep -rn "from 'marked'\|from \"marked\"" --include='*.ts' --include='*.vue' . --exclude-dir=node_modules
# if no hits outside mcp-server/: npm uninstall marked
npm audit
npm audit fix   # non-breaking only; do NOT pass --force
npm audit       # note remaining count in the commit message
```

- [ ] **Step 6: Update `.env.example`**

Remove `OPENAI_API_KEY` and `ANTHROPIC_API_KEY` entries. (SFL vars arrive in Task 9.)

- [ ] **Step 7: Verify and commit**

Run: `npm run build && npx jest`
Expected: PASS / PASS.

```bash
git add -A
git commit -m "Remove AI summary surfaces, Unsplash filler, and dead deps"
```

---

## Task 4: Deck logic (TDD)

**Files:**
- Create: `utils/deck.ts` (fresh — the old one was deleted in Task 2), `__tests__/utils/deck.test.ts`

- [ ] **Step 1: Write the failing tests**

`__tests__/utils/deck.test.ts`:

```ts
import {
  resolveDirection,
  advance,
  undo,
  DECK,
  type DeckHistoryEntry,
} from '~/utils/deck'

describe('resolveDirection (velocity-aware)', () => {
  it('returns null for a tiny slow drag', () => {
    expect(resolveDirection(20, 5, 0, 0)).toBeNull()
  })

  it('commits on distance past the threshold', () => {
    expect(resolveDirection(DECK.DISTANCE_THRESHOLD + 1, 0, 0, 0)).toBe('right')
    expect(resolveDirection(-(DECK.DISTANCE_THRESHOLD + 1), 0, 0, 0)).toBe('left')
    expect(resolveDirection(0, -(DECK.DISTANCE_THRESHOLD + 1), 0, 0)).toBe('up')
    expect(resolveDirection(0, DECK.DISTANCE_THRESHOLD + 1, 0, 0)).toBe('down')
  })

  it('commits on a fast flick below the distance threshold', () => {
    expect(resolveDirection(40, 0, DECK.VELOCITY_THRESHOLD + 1, 0)).toBe('right')
    expect(resolveDirection(-40, 0, -(DECK.VELOCITY_THRESHOLD + 1), 0)).toBe('left')
    expect(resolveDirection(0, -40, 0, -(DECK.VELOCITY_THRESHOLD + 1))).toBe('up')
  })

  it('does NOT commit a flick whose velocity opposes the offset', () => {
    // dragged right but flicking back left toward origin
    expect(resolveDirection(60, 0, -(DECK.VELOCITY_THRESHOLD + 1), 0)).toBeNull()
  })

  it('returns null when neither axis dominates', () => {
    const d = DECK.DISTANCE_THRESHOLD + 10
    expect(resolveDirection(d, d, 0, 0)).toBeNull()
  })

  it('picks the dominant axis', () => {
    const d = DECK.DISTANCE_THRESHOLD + 10
    expect(resolveDirection(d, d * 0.3, 0, 0)).toBe('right')
    expect(resolveDirection(d * 0.3, -d, 0, 0)).toBe('up')
  })
})

describe('advance', () => {
  const deck = ['a', 'b', 'c']

  it('removes the top card for save/read/elevate', () => {
    for (const action of ['left', 'right', 'up'] as const) {
      const { deck: next, entry } = advance(deck, action)
      expect(next).toEqual(['b', 'c'])
      expect(entry).toEqual({ id: 'a', action, prevIndex: 0 })
    }
  })

  it('rotates the top card to the back on skip (down)', () => {
    const { deck: next, entry } = advance(deck, 'down')
    expect(next).toEqual(['b', 'c', 'a'])
    expect(entry).toEqual({ id: 'a', action: 'down', prevIndex: 0 })
  })

  it('is a no-op on an empty deck', () => {
    const { deck: next, entry } = advance([], 'right')
    expect(next).toEqual([])
    expect(entry).toBeNull()
  })
})

describe('undo', () => {
  it('returns null with no history', () => {
    expect(undo(['a'], [])).toBeNull()
  })

  it('restores a removed card to the top and pops history', () => {
    const history: DeckHistoryEntry[] = [{ id: 'a', action: 'left', prevIndex: 0 }]
    const result = undo(['b', 'c'], history)!
    expect(result.deck).toEqual(['a', 'b', 'c'])
    expect(result.history).toEqual([])
    expect(result.entry.action).toBe('left')
  })

  it('moves a skipped card from the back to the top without duplicating', () => {
    const history: DeckHistoryEntry[] = [{ id: 'a', action: 'down', prevIndex: 0 }]
    const result = undo(['b', 'c', 'a'], history)!
    expect(result.deck).toEqual(['a', 'b', 'c'])
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest __tests__/utils/deck.test.ts`
Expected: FAIL — cannot find module `~/utils/deck`.

- [ ] **Step 3: Write `utils/deck.ts`**

```ts
/**
 * deck.ts — pure deck state machine for the card-stack entrance.
 *
 * No DOM, no Vue, no side effects. The CardStack component drives these
 * reducers; motion-v owns the rendering physics.
 *
 * Direction semantics (spec §3):
 *   left  → save     — removes the top card
 *   right → read     — removes the top card
 *   up    → elevate  — removes the top card (SFL promotion)
 *   down  → skip     — rotates the top card to the back
 */

export type DeckDirection = 'left' | 'right' | 'up' | 'down'

/** Tunable physics + commit constants, in one place (spec §3). */
export const DECK = {
  /** Min dominant-axis distance (px) for a slow-drag commit. */
  DISTANCE_THRESHOLD: 110,
  /** Min dominant-axis velocity (px/s) for a flick commit. */
  VELOCITY_THRESHOLD: 600,
  /** Dominant axis must beat the other by this ratio, else ambiguous. */
  DOMINANCE_RATIO: 1.4,
  /** Card rotation at full horizontal drag, degrees. */
  MAX_ROTATION: 9,
  /** Spring for snap-back and stack promotion. */
  SPRING: { type: 'spring' as const, stiffness: 420, damping: 34 },
  /** Spring for the off-screen fling. */
  FLING: { type: 'spring' as const, stiffness: 220, damping: 30 },
} as const

export interface DeckHistoryEntry {
  id: string
  action: DeckDirection
  prevIndex: number
  /** SFL idea id, recorded on elevate so undo can delete it. */
  ideaId?: string
  /** True when SFL reported the idea already existed (undo must NOT delete). */
  ideaExisting?: boolean
}

/**
 * Resolve a release (offset + velocity) into a commit direction, or null for
 * a spring-back. A commit happens on EITHER sufficient distance OR a flick —
 * but a flick only counts when its velocity points the same way as the
 * offset (flicking back toward origin must not commit).
 */
export function resolveDirection(
  dx: number,
  dy: number,
  vx: number,
  vy: number,
): DeckDirection | null {
  const absX = Math.abs(dx)
  const absY = Math.abs(dy)

  const horizontalDominant = absX >= absY * DECK.DOMINANCE_RATIO
  const verticalDominant = absY >= absX * DECK.DOMINANCE_RATIO

  if (horizontalDominant) {
    const flick = Math.abs(vx) >= DECK.VELOCITY_THRESHOLD && Math.sign(vx) === Math.sign(dx)
    if (absX >= DECK.DISTANCE_THRESHOLD || flick) return dx < 0 ? 'left' : 'right'
    return null
  }

  if (verticalDominant) {
    const flick = Math.abs(vy) >= DECK.VELOCITY_THRESHOLD && Math.sign(vy) === Math.sign(dy)
    if (absY >= DECK.DISTANCE_THRESHOLD || flick) return dy < 0 ? 'up' : 'down'
    return null
  }

  return null
}

/**
 * Apply a committed direction to the deck. Returns a NEW deck plus the
 * history entry to record (null entry when the deck was empty).
 */
export function advance(
  deck: readonly string[],
  action: DeckDirection,
): { deck: string[]; entry: DeckHistoryEntry | null } {
  if (deck.length === 0) return { deck: [], entry: null }

  const [top, ...rest] = deck
  const entry: DeckHistoryEntry = { id: top, action, prevIndex: 0 }

  if (action === 'down') return { deck: [...rest, top], entry }
  return { deck: rest, entry }
}

/**
 * Undo the most recent entry: the card returns to the top of the deck (for
 * skips the back-copy is removed first so it never appears twice). Callers
 * reverse the corresponding API effect using the returned entry.
 */
export function undo(
  deck: readonly string[],
  history: readonly DeckHistoryEntry[],
): { deck: string[]; history: DeckHistoryEntry[]; entry: DeckHistoryEntry } | null {
  if (history.length === 0) return null

  const entry = history[history.length - 1]
  const without = deck.filter((id) => id !== entry.id)
  return {
    deck: [entry.id, ...without],
    history: history.slice(0, -1),
    entry,
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest __tests__/utils/deck.test.ts`
Expected: PASS (all).

- [ ] **Step 5: Commit**

```bash
git add utils/deck.ts __tests__/utils/deck.test.ts
git commit -m "Rebuild deck state machine with velocity-aware commits (TDD)"
```

---

## Task 5: Card data utilities (TDD)

**Files:**
- Create: `utils/cardData.ts`, `__tests__/utils/cardData.test.ts`

- [ ] **Step 1: Write the failing tests**

`__tests__/utils/cardData.test.ts`:

```ts
import { readingTimeMinutes, cardImageUrl, excerpt } from '~/utils/cardData'

describe('readingTimeMinutes', () => {
  it('returns null for missing or thin content (excerpt-only RSS)', () => {
    expect(readingTimeMinutes(null)).toBeNull()
    expect(readingTimeMinutes(undefined)).toBeNull()
    expect(readingTimeMinutes('<p>' + 'word '.repeat(100) + '</p>')).toBeNull()
  })

  it('estimates minutes at 220 wpm on stripped text', () => {
    const html = '<article><p>' + 'word '.repeat(660) + '</p></article>'
    expect(readingTimeMinutes(html)).toBe(3)
  })

  it('rounds up', () => {
    const html = '<p>' + 'word '.repeat(230) + '</p>'
    expect(readingTimeMinutes(html)).toBe(2)
  })
})

describe('cardImageUrl', () => {
  it('passes through a real article image', () => {
    expect(cardImageUrl('https://cdn.example.com/lead.jpg')).toBe('https://cdn.example.com/lead.jpg')
  })

  it.each([
    'https://images.unsplash.com/photo-123?w=600',
    'https://source.unsplash.com/random/800x600',
  ])('filters legacy Unsplash filler: %s', (url) => {
    expect(cardImageUrl(url)).toBeNull()
  })

  it('handles null/undefined', () => {
    expect(cardImageUrl(null)).toBeNull()
    expect(cardImageUrl(undefined)).toBeNull()
  })
})

describe('excerpt', () => {
  it('strips tags and truncates on a word boundary with an ellipsis', () => {
    const html = '<p>Alpha <b>beta</b> gamma delta epsilon zeta</p>'
    expect(excerpt(html, 20)).toBe('Alpha beta gamma…')
  })

  it('returns short text untouched', () => {
    expect(excerpt('<p>Short.</p>', 200)).toBe('Short.')
  })

  it('returns empty string for nothing', () => {
    expect(excerpt(null, 100)).toBe('')
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npx jest __tests__/utils/cardData.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `utils/cardData.ts`**

```ts
/**
 * cardData.ts — pure derivations from an Article for the deck card.
 */

const WPM = 220
/** Below this word count we assume the RSS body is an excerpt, not the article. */
const THIN_WORDS = 150

/** Legacy rows carry Unsplash filler from the old feed parser — never show it. */
const FILLER_IMAGE = /(?:images|source)\.unsplash\.com/

export function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&[a-z#0-9]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function readingTimeMinutes(html: string | null | undefined): number | null {
  if (!html) return null
  const words = stripHtml(html).split(' ').filter(Boolean).length
  if (words < THIN_WORDS) return null
  return Math.ceil(words / WPM)
}

export function cardImageUrl(url: string | null | undefined): string | null {
  if (!url || FILLER_IMAGE.test(url)) return null
  return url
}

export function excerpt(html: string | null | undefined, maxChars: number): string {
  if (!html) return ''
  const text = stripHtml(html)
  if (text.length <= maxChars) return text
  const cut = text.slice(0, maxChars)
  const lastSpace = cut.lastIndexOf(' ')
  return (lastSpace > 0 ? cut.slice(0, lastSpace) : cut).trimEnd() + '…'
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx jest __tests__/utils/cardData.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add utils/cardData.ts __tests__/utils/cardData.test.ts
git commit -m "Add card data utils: reading time, filler-image filter, excerpt (TDD)"
```

---

## Task 6: ArticleCard component

**Files:**
- Create: `components/stack/ArticleCard.vue`

- [ ] **Step 1: Create `components/stack/ArticleCard.vue`**

The approved design: full-bleed image to the card's top/side borders with source + headline overlaid on a bottom-up scrim; typographic fallback when no image; excerpt + reading time on paper below.

```vue
<template>
  <CardFrame class="flex h-full flex-col">
    <!-- With lead image: full bleed, headline overlaid -->
    <div v-if="image" class="relative shrink-0" style="height: 52%;">
      <img
        :src="image"
        alt=""
        class="absolute inset-0 h-full w-full object-cover"
        style="filter: saturate(.85);"
        draggable="false"
      />
      <div
        class="absolute inset-0"
        style="background: linear-gradient(to top, rgba(20,16,10,.78) 0%, rgba(20,16,10,.25) 55%, rgba(20,16,10,.05) 100%);"
      />
      <div class="absolute inset-x-0 bottom-0 px-5 pb-4">
        <div class="font-mono uppercase" style="font-size: 10px; letter-spacing: 0.16em; color: rgba(255,250,240,.85);">
          &mdash; {{ article.feedTitle }} &middot; {{ relativeDate }}
        </div>
        <h2 class="mt-1.5 text-2xl leading-snug" style="color: #fffdf6; text-shadow: 0 1px 2px rgba(0,0,0,.35);">
          {{ article.title }}
        </h2>
      </div>
    </div>

    <!-- Without image: typographic head -->
    <div v-else class="px-5 pt-5">
      <div class="flex items-baseline justify-between">
        <MonoLabel dash>{{ article.feedTitle }}</MonoLabel>
        <MonoLabel>{{ relativeDate }}</MonoLabel>
      </div>
      <h2 class="mt-3 text-2xl leading-snug text-ink">{{ article.title }}</h2>
      <HairlineRule class="mt-4" />
    </div>

    <!-- Shared body -->
    <div class="flex min-h-0 flex-1 flex-col px-5 py-4">
      <p class="excerpt-clamp text-base leading-relaxed text-body">{{ excerptText }}</p>
      <div class="mt-auto pt-3">
        <MonoLabel v-if="minutes">{{ minutes }} min read</MonoLabel>
      </div>
    </div>
  </CardFrame>
</template>

<script setup lang="ts">
import type { Article } from '~/types'
import { cardImageUrl, excerpt, readingTimeMinutes } from '~/utils/cardData'
import { formatRelativeDate } from '~/utils/formatDate'

const props = defineProps<{ article: Article }>()

const image = computed(() => cardImageUrl(props.article.imageUrl))
const excerptText = computed(() =>
  excerpt(props.article.content || props.article.summary, 280)
)
const minutes = computed(() => readingTimeMinutes(props.article.content))
const relativeDate = computed(() =>
  props.article.publishedAt ? formatRelativeDate(props.article.publishedAt) : ''
)
</script>

<style scoped>
.excerpt-clamp {
  display: -webkit-box;
  -webkit-line-clamp: 4;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
```

(Check `utils/formatDate.ts` for the actual export name — `formatRelativeDate` per CLAUDE.md; adjust the import if it differs.)

- [ ] **Step 2: Verify it renders (smoke via build) and commit**

Run: `npm run build`
Expected: PASS.

```bash
git add components/stack/ArticleCard.vue
git commit -m "Add ArticleCard: full-bleed image variant + typographic fallback"
```

---

## Task 7: CardStack with motion-v physics

**Files:**
- Create: `components/stack/CardStack.vue`, `components/stack/DeckEmptyState.vue`, `components/stack/UndoToast.vue`
- Modify: `package.json` (add motion-v), `pages/index.vue`, `jest.config.js`
- Test: `__tests__/components/CardStack.test.ts`

- [ ] **Step 1: Install motion-v**

```bash
npm install motion-v
```

- [ ] **Step 2: Create `components/stack/DeckEmptyState.vue`**

```vue
<template>
  <div class="flex flex-col items-center gap-6 text-center">
    <div class="text-4xl text-faint" aria-hidden="true">&#9789;</div>
    <p class="max-w-xs text-lg italic text-mute">
      All caught up. The next good thing will arrive on its own time.
    </p>
    <ActionLabel :disabled="syncing" @click="emit('sync')">
      {{ syncing ? 'Syncing…' : 'Sync all' }}
    </ActionLabel>
  </div>
</template>

<script setup lang="ts">
defineProps<{ syncing?: boolean }>()
const emit = defineEmits<{ sync: [] }>()
</script>
```

- [ ] **Step 3: Create `components/stack/UndoToast.vue`**

```vue
<template>
  <Transition name="undo">
    <div v-if="visible" class="fixed bottom-16 left-1/2 z-50 -translate-x-1/2">
      <ActionLabel accent @click="emit('undo')">Undo {{ label }}</ActionLabel>
    </div>
  </Transition>
</template>

<script setup lang="ts">
defineProps<{ visible: boolean; label: string }>()
const emit = defineEmits<{ undo: [] }>()
</script>

<style scoped>
.undo-enter-active, .undo-leave-active { transition: opacity .2s ease; }
.undo-enter-from, .undo-leave-to { opacity: 0; }
</style>
```

- [ ] **Step 4: Create `components/stack/CardStack.vue`**

This is the heart of the rebuild. Notes on the mechanics:
- Only the **top card** is a drag target. `dragSnapToOrigin` gives the spring-back; on `@dragEnd` we resolve a direction and, if committed, beat the snap-back with an imperative `animate()` fling that carries the release velocity.
- Elevate (`up`) is **non-optimistic** (spec §6): the card holds at a small upward offset while the API call runs; failure springs it back.
- The under-cards get their depth from `:animate`d scale/translate so promotion is a spring, not a CSS transition.
- The pending verb is the screen's one accent, driven by `@drag` offsets into a plain ref (cheap, no MotionValue plumbing needed for labels).

```vue
<template>
  <div class="relative h-full w-full" style="touch-action: none;">
    <!-- Under-cards (depth) + top card (drag) -->
    <template v-for="(article, i) in visibleCards" :key="article.id">
      <!-- Top card -->
      <motion.div
        v-if="i === 0"
        class="absolute inset-0 z-30"
        :style="{ x, y, rotate }"
        drag
        drag-snap-to-origin
        :drag-elastic="0.9"
        :drag-momentum="false"
        :while-press="{ scale: 1.015 }"
        @drag-start="dragging = true"
        @drag="onDrag"
        @drag-end="onDragEnd"
        @click="onTap(article)"
      >
        <ArticleCard :article="article" class="h-full" />
      </motion.div>

      <!-- Under-cards -->
      <motion.div
        v-else
        class="absolute inset-0"
        :class="i === 1 ? 'z-20' : 'z-10'"
        :initial="false"
        :animate="{ scale: 1 - i * 0.03, y: i * 12, opacity: 1 - i * 0.18 }"
        :transition="DECK.SPRING"
        aria-hidden="true"
      >
        <ArticleCard :article="article" class="h-full" />
      </motion.div>
    </template>

    <!-- Pending-verb labels: the one accent, fading in toward commit -->
    <div v-if="dragging" class="pointer-events-none absolute inset-0 z-40">
      <div class="absolute left-4 top-1/2 -translate-y-1/2" :style="{ opacity: pending === 'left' ? pendingProgress : 0 }">
        <ActionLabel accent>Save</ActionLabel>
      </div>
      <div class="absolute right-4 top-1/2 -translate-y-1/2" :style="{ opacity: pending === 'right' ? pendingProgress : 0 }">
        <ActionLabel accent>Read</ActionLabel>
      </div>
      <div class="absolute left-1/2 top-4 -translate-x-1/2" :style="{ opacity: pending === 'up' ? pendingProgress : 0 }">
        <ActionLabel accent>Elevate</ActionLabel>
      </div>
      <div class="absolute bottom-4 left-1/2 -translate-x-1/2" :style="{ opacity: pending === 'down' ? pendingProgress : 0 }">
        <ActionLabel accent>Skip</ActionLabel>
      </div>
    </div>

    <!-- Empty -->
    <div v-if="deckIds.length === 0" class="absolute inset-0 z-0 flex items-center justify-center">
      <DeckEmptyState :syncing="syncing" @sync="emit('sync')" />
    </div>

    <UndoToast :visible="undoVisible" :label="undoLabel" @undo="performUndo" />
  </div>
</template>

<script setup lang="ts">
import { motion, useMotionValue, useTransform, animate } from 'motion-v'
import type { PanInfo } from 'motion-v'
import type { Article } from '~/types'
import {
  DECK,
  resolveDirection,
  advance,
  undo as undoDeck,
  type DeckDirection,
  type DeckHistoryEntry,
} from '~/utils/deck'

const props = defineProps<{ articles: Article[]; syncing?: boolean }>()
const emit = defineEmits<{ sync: []; count: [n: number] }>()

const { saveArticle, unsaveArticle } = useSavedArticles()
const { markAsRead } = useArticles()
const { elevate, unElevate } = useElevate()
const { showError } = useToast()

/* ── Deck state ────────────────────────────────────────────────────── */
const deckIds = ref<string[]>([])
const history = ref<DeckHistoryEntry[]>([])

watch(
  () => props.articles,
  (articles) => {
    // Refill wholesale (initial load / feed sync). Preserves nothing — the
    // deck IS the unread stream, newest first.
    deckIds.value = articles.map((a) => String(a.id))
    history.value = []
  },
  { immediate: true },
)

// The parent header shows the live deck size (the prop is a static snapshot).
watch(deckIds, (ids) => emit('count', ids.length), { immediate: true, deep: true })

const byId = computed(() => new Map(props.articles.map((a) => [String(a.id), a])))
const visibleCards = computed(() =>
  deckIds.value.slice(0, 3).map((id) => byId.value.get(id)!).filter(Boolean),
)

/* ── Drag physics ──────────────────────────────────────────────────── */
const x = useMotionValue(0)
const y = useMotionValue(0)
const rotate = useTransform(x, [-300, 300], [-DECK.MAX_ROTATION, DECK.MAX_ROTATION])

const dragging = ref(false)
const pending = ref<DeckDirection | null>(null)
const pendingProgress = ref(0)
const busy = ref(false)
const movedFar = ref(false)

function onDrag(_e: PointerEvent, info: PanInfo) {
  const { x: dx, y: dy } = info.offset
  if (Math.abs(dx) > 8 || Math.abs(dy) > 8) movedFar.value = true
  const absX = Math.abs(dx)
  const absY = Math.abs(dy)
  if (absX >= absY * DECK.DOMINANCE_RATIO) {
    pending.value = dx < 0 ? 'left' : 'right'
    pendingProgress.value = Math.min(1, absX / DECK.DISTANCE_THRESHOLD)
  } else if (absY >= absX * DECK.DOMINANCE_RATIO) {
    pending.value = dy < 0 ? 'up' : 'down'
    pendingProgress.value = Math.min(1, absY / DECK.DISTANCE_THRESHOLD)
  } else {
    pending.value = null
    pendingProgress.value = 0
  }
}

async function onDragEnd(_e: PointerEvent, info: PanInfo) {
  dragging.value = false
  pending.value = null
  const dir = resolveDirection(info.offset.x, info.offset.y, info.velocity.x, info.velocity.y)
  // Defer the tap-guard reset so the click event (which fires after dragEnd)
  // still sees movedFar=true and ignores the tap.
  setTimeout(() => { movedFar.value = false }, 0)
  if (dir) await commit(dir, { vx: info.velocity.x, vy: info.velocity.y })
  // else: dragSnapToOrigin springs the card home.
}

function onTap(article: Article) {
  if (movedFar.value || busy.value) return
  navigateTo(`/article/${article.id}`)
}

/* ── Commits ───────────────────────────────────────────────────────── */
async function flingOff(dir: DeckDirection, vx = 0, vy = 0) {
  const w = typeof window === 'undefined' ? 800 : window.innerWidth
  const h = typeof window === 'undefined' ? 800 : window.innerHeight
  const target = { left: -w * 1.2, right: w * 1.2, up: -h * 1.1, down: h * 1.1 }[dir]
  const mv = dir === 'left' || dir === 'right' ? x : y
  const velocity = dir === 'left' || dir === 'right' ? vx : vy
  await animate(mv, target, { ...DECK.FLING, velocity })
}

function resetCard() {
  x.set(0)
  y.set(0)
}

async function springBack() {
  await Promise.all([
    animate(x, 0, DECK.SPRING),
    animate(y, 0, DECK.SPRING),
  ])
}

async function commit(dir: DeckDirection, v: { vx: number; vy: number } = { vx: 0, vy: 0 }) {
  if (busy.value || deckIds.value.length === 0) return
  busy.value = true
  const topId = deckIds.value[0]

  try {
    if (dir === 'up') {
      // Non-optimistic: hold the card up while SFL answers.
      await animate(y, -140, DECK.SPRING)
      let result
      try {
        result = await elevate(Number(topId))
      } catch {
        showError('Could not reach SFL — card kept')
        await springBack()
        return
      }
      await flingOff('up', 0, v.vy)
      applyAdvance('up', { ideaId: result.ideaId, ideaExisting: result.existing })
      markAsRead(Number(topId), true).catch(() => {})
      showUndo('Elevate')
    } else if (dir === 'left') {
      await flingOff('left', v.vx)
      applyAdvance('left')
      saveArticle(Number(topId)).catch(() => showError('Save failed'))
      showUndo('Save')
    } else if (dir === 'right') {
      await flingOff('right', v.vx)
      applyAdvance('right')
      markAsRead(Number(topId), true).catch(() => showError('Mark-read failed'))
      showUndo('Read')
    } else {
      await flingOff('down', 0, v.vy)
      applyAdvance('down')
    }
  } finally {
    resetCard()
    busy.value = false
  }
}

function applyAdvance(dir: DeckDirection, extra?: Partial<DeckHistoryEntry>) {
  const { deck, entry } = advance(deckIds.value, dir)
  deckIds.value = deck
  if (entry) history.value = [...history.value, { ...entry, ...extra }]
}

/* ── Undo ──────────────────────────────────────────────────────────── */
const undoVisible = ref(false)
const undoLabel = ref('')
let undoTimer: ReturnType<typeof setTimeout> | null = null

function showUndo(label: string) {
  undoLabel.value = label
  undoVisible.value = true
  if (undoTimer) clearTimeout(undoTimer)
  undoTimer = setTimeout(() => { undoVisible.value = false }, 5000)
}

async function performUndo() {
  undoVisible.value = false
  const result = undoDeck(deckIds.value, history.value)
  if (!result) return
  deckIds.value = result.deck
  history.value = result.history
  const { entry } = result
  const id = Number(entry.id)
  try {
    if (entry.action === 'left') await unsaveArticle(id)
    else if (entry.action === 'right') await markAsRead(id, false)
    else if (entry.action === 'up') {
      await unElevate(id, entry.ideaId, entry.ideaExisting)
      await markAsRead(id, false)
    }
  } catch {
    showError('Undo could not reach the server')
  }
}

defineExpose({ commit, undo: performUndo })
</script>
```

(`useElevate` does not exist until Task 9 — for THIS task, create a stub `composables/useElevate.ts`:)

```ts
export const useElevate = () => ({
  // Real implementation lands with the elevate API task.
  elevate: async (_articleId: number): Promise<{ ideaId: string; existing: boolean }> => {
    throw new Error('Elevate not wired yet')
  },
  unElevate: async (_articleId: number, _ideaId?: string, _existing?: boolean) => {},
})
```

- [ ] **Step 5: Rewrite `pages/index.vue` (the Deck room)**

```vue
<template>
  <main class="mx-auto flex h-dvh max-w-xl flex-col px-4 pb-16 pt-4">
    <header class="flex items-baseline justify-between pb-3">
      <MonoLabel dash>The Reader</MonoLabel>
      <MonoLabel>{{ unreadCount }} unread</MonoLabel>
    </header>
    <HairlineRule />

    <div class="relative min-h-0 flex-1 py-4">
      <ClientOnly>
        <CardStack
          ref="stack"
          :articles="deckArticles"
          :syncing="syncing"
          @sync="syncAll"
          @count="unreadCount = $event"
        />
      </ClientOnly>
    </div>
  </main>
</template>

<script setup lang="ts">
import type { Article } from '~/types'

const { fetchArticles, unreadArticles } = useArticles()
const { fetchSavedArticleIds } = useSavedArticles()
const { syncAll: syncFeeds } = useFeeds()
const { showSuccess, showError } = useToast()

const stack = ref()
const syncing = ref(false)

// SNAPSHOT, deliberately not the live `unreadArticles` computed: markAsRead
// optimistically flips isRead, which would shrink a computed deck on every
// right-swipe, retrigger CardStack's refill watcher, and wipe the deck +
// undo history mid-session. The deck refills only on load and explicit sync.
const deckArticles = ref<Article[]>([])
const unreadCount = ref(0) // kept live by CardStack's @count emit

function refillDeck() {
  deckArticles.value = [...unreadArticles.value] as Article[]
}

onMounted(async () => {
  await Promise.all([fetchArticles(), fetchSavedArticleIds()])
  refillDeck()
})

async function syncAll() {
  syncing.value = true
  try {
    await syncFeeds()
    await fetchArticles()
    refillDeck()
    showSuccess('Feeds synced')
  } catch {
    showError('Sync failed')
  } finally {
    syncing.value = false
  }
}

// Deck keyboard verbs (full shortcut system arrives in Task 12; arrows live
// here because they belong to the deck).
function onKey(e: KeyboardEvent) {
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
  const map: Record<string, string> = {
    ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down',
  }
  if (map[e.key]) {
    e.preventDefault()
    stack.value?.commit(map[e.key])
  } else if (e.key === 'u') {
    stack.value?.undo()
  }
}
onMounted(() => window.addEventListener('keydown', onKey))
onUnmounted(() => window.removeEventListener('keydown', onKey))
</script>
```

(The header count is driven by CardStack's `@count` emit — it ticks down as cards leave and back up on undo, while the `deckArticles` snapshot itself stays put until load/sync.)

- [ ] **Step 6: Component test for commit wiring**

Add to `jest.config.js` `moduleNameMapper` (motion-v is ESM; we mock it entirely rather than transform it):

```js
    '^motion-v$': '<rootDir>/__tests__/mocks/motion-v.ts',
```

Create `__tests__/mocks/motion-v.ts`:

```ts
import { defineComponent, h } from 'vue'

const passthrough = (tag: string) =>
  defineComponent({
    inheritAttrs: false,
    setup(_, { slots, attrs }) {
      return () => h(tag, attrs, slots.default?.())
    },
  })

export const motion = new Proxy({} as Record<string, any>, {
  get: (_t, key: string) => passthrough(typeof key === 'string' ? 'div' : 'div'),
})

export const AnimatePresence = passthrough('div')

export function useMotionValue(initial: number) {
  let v = initial
  return { get: () => v, set: (n: number) => { v = n }, on: () => () => {} }
}

export function useTransform() {
  return useMotionValue(0)
}

export function animate(_mv: any, _target: any, _opts?: any) {
  const p = Promise.resolve()
  return Object.assign(p, { stop: () => {} })
}

export type PanInfo = {
  point: { x: number; y: number }
  delta: { x: number; y: number }
  offset: { x: number; y: number }
  velocity: { x: number; y: number }
}
```

Create `__tests__/components/CardStack.test.ts`:

```ts
import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import CardStack from '~/components/stack/CardStack.vue'

const saveArticle = jest.fn().mockResolvedValue(undefined)
const unsaveArticle = jest.fn().mockResolvedValue(undefined)
const markAsRead = jest.fn().mockResolvedValue(undefined)
const elevate = jest.fn().mockResolvedValue({ ideaId: 'idea-1', existing: false })
const unElevate = jest.fn().mockResolvedValue(undefined)
const showError = jest.fn()

// Nuxt auto-imported composables don't exist under Jest — provide globals.
;(globalThis as any).useSavedArticles = () => ({ saveArticle, unsaveArticle })
;(globalThis as any).useArticles = () => ({ markAsRead })
;(globalThis as any).useElevate = () => ({ elevate, unElevate })
;(globalThis as any).useToast = () => ({ showError })
;(globalThis as any).navigateTo = jest.fn()

const stubs = {
  ArticleCard: defineComponent({ props: ['article'], setup: (p: any) => () => h('div', `card-${p.article.id}`) }),
  DeckEmptyState: true,
  UndoToast: true,
  ActionLabel: true,
  MonoLabel: true,
}

const articles = [
  { id: 1, title: 'One', feedTitle: 'Feed', isRead: false },
  { id: 2, title: 'Two', feedTitle: 'Feed', isRead: false },
  { id: 3, title: 'Three', feedTitle: 'Feed', isRead: false },
] as any[]

function mountStack() {
  return mount(CardStack, { props: { articles }, global: { stubs } })
}

beforeEach(() => jest.clearAllMocks())

describe('CardStack commit wiring', () => {
  it('left commit saves the top card and advances', async () => {
    const w = mountStack()
    await (w.vm as any).commit('left')
    await flushPromises()
    expect(saveArticle).toHaveBeenCalledWith(1)
    expect(w.text()).toContain('card-2')
  })

  it('right commit marks read', async () => {
    const w = mountStack()
    await (w.vm as any).commit('right')
    await flushPromises()
    expect(markAsRead).toHaveBeenCalledWith(1, true)
  })

  it('down commit skips with no API call', async () => {
    const w = mountStack()
    await (w.vm as any).commit('down')
    await flushPromises()
    expect(saveArticle).not.toHaveBeenCalled()
    expect(markAsRead).not.toHaveBeenCalled()
    expect(w.text()).toContain('card-2')
  })

  it('up commit elevates then marks read', async () => {
    const w = mountStack()
    await (w.vm as any).commit('up')
    await flushPromises()
    expect(elevate).toHaveBeenCalledWith(1)
    expect(markAsRead).toHaveBeenCalledWith(1, true)
  })

  it('failed elevate keeps the card and shows an error', async () => {
    elevate.mockRejectedValueOnce(new Error('down'))
    const w = mountStack()
    await (w.vm as any).commit('up')
    await flushPromises()
    expect(showError).toHaveBeenCalled()
    expect(markAsRead).not.toHaveBeenCalled()
    expect(w.text()).toContain('card-1') // still on top
  })

  it('undo after save unsaves and restores the card', async () => {
    const w = mountStack()
    await (w.vm as any).commit('left')
    await flushPromises()
    await (w.vm as any).undo()
    await flushPromises()
    expect(unsaveArticle).toHaveBeenCalledWith(1)
    expect(w.text()).toContain('card-1')
  })

  it('undo after elevate deletes the idea only when it was newly created', async () => {
    const w = mountStack()
    await (w.vm as any).commit('up')
    await flushPromises()
    await (w.vm as any).undo()
    await flushPromises()
    expect(unElevate).toHaveBeenCalledWith(1, 'idea-1', false)
  })
})
```

- [ ] **Step 7: Run the tests**

Run: `npx jest __tests__/components/CardStack.test.ts`
Expected: PASS. (If auto-imported `computed`/`ref`/`watch` are unresolved under Jest, add `import { ref, computed, watch } from 'vue'` to `CardStack.vue` — harmless under Nuxt, required under Jest.)

- [ ] **Step 8: Manual feel pass**

Run: `npm run dev` and open on a phone (or devtools touch emulation). Tune in `utils/deck.ts` (`DECK.SPRING`, `DECK.FLING`, thresholds, `MAX_ROTATION`) until: the card tracks the finger exactly, a lazy half-drag springs back with weight (no bounce-forever, no dead stop), a flick commits crisply, the next card's promotion feels like paper settling. Record any constant changes in the commit message.

- [ ] **Step 9: Verify all tests + build, commit**

Run: `npx jest && npm run build`
Expected: PASS / PASS.

```bash
git add -A
git commit -m "Add motion-v card stack: velocity commits, spring-back, undo"
```

---

## Task 8: The reader

**Files:**
- Modify: `pages/article/[id].vue` (replace the Task 2 stub)

- [ ] **Step 1: Rewrite `pages/article/[id].vue`**

```vue
<template>
  <main class="mx-auto max-w-measure px-5 py-6">
    <!-- Action row -->
    <div class="flex items-center justify-between">
      <ActionLabel @click="goBack">Back</ActionLabel>
      <div class="flex gap-2">
        <ActionLabel :accent="saved" @click="toggleSaveAction">{{ saved ? 'Saved' : 'Save' }}</ActionLabel>
        <ActionLabel @click="elevateAction" :disabled="elevating">{{ elevating ? 'Elevating…' : 'Elevate' }}</ActionLabel>
        <ActionLabel @click="openOriginal">Original</ActionLabel>
      </div>
    </div>
    <HairlineRule class="mt-4" />

    <template v-if="article">
      <header class="mt-8">
        <div class="flex items-baseline justify-between">
          <MonoLabel dash>{{ article.feedTitle }}</MonoLabel>
          <MonoLabel>{{ relativeDate }}</MonoLabel>
        </div>
        <h1 class="mt-3 text-3xl leading-tight text-ink">{{ article.title }}</h1>
        <p v-if="article.author" class="mt-2 italic text-mute">{{ article.author }}</p>
      </header>

      <HairlineRule class="my-6" />

      <p v-if="fetchingFullText" class="italic text-mute">Fetching the full article…</p>
      <article class="prose pb-24" v-html="sanitizedContent" />
    </template>

    <p v-else-if="error" class="mt-10 italic text-mute">{{ error }}</p>
    <p v-else class="mt-10 italic text-mute">Loading…</p>
  </main>
</template>

<script setup lang="ts">
import DOMPurify from 'isomorphic-dompurify'
import { formatRelativeDate } from '~/utils/formatDate'
import { stripHtml } from '~/utils/cardData'

const route = useRoute()
const router = useRouter()
const id = Number(route.params.id)

const { isSaved, saveArticle, unsaveArticle, fetchSavedArticleIds } = useSavedArticles()
const { elevate } = useElevate()
const { markAsRead } = useArticles()
const { showSuccess, showError } = useToast()

const article = ref<any>(null)
const error = ref<string | null>(null)
const fetchingFullText = ref(false)
const elevating = ref(false)

const saved = computed(() => isSaved(id))
const relativeDate = computed(() =>
  article.value?.publishedAt ? formatRelativeDate(article.value.publishedAt) : ''
)
const sanitizedContent = computed(() =>
  article.value?.content ? DOMPurify.sanitize(article.value.content) : ''
)

/** RSS bodies under ~1200 visible chars are treated as excerpts → fetch full text. */
const THIN_CHARS = 1200

onMounted(async () => {
  fetchSavedArticleIds().catch(() => {})
  try {
    article.value = await $fetch(`/api/articles/${id}`)
  } catch (err: any) {
    error.value = err.statusMessage || 'Could not load the article'
    return
  }

  const visible = stripHtml(article.value?.content || '')
  if (visible.length < THIN_CHARS) {
    fetchingFullText.value = true
    try {
      await $fetch(`/api/articles/${id}/fetch-fulltext`, { method: 'POST' })
      article.value = await $fetch(`/api/articles/${id}`)
    } catch {
      // Keep the excerpt — "Original" is one tap away.
    } finally {
      fetchingFullText.value = false
    }
  }
})

function goBack() {
  if (window.history.length > 1) router.back()
  else navigateTo('/')
}

async function toggleSaveAction() {
  try {
    if (saved.value) { await unsaveArticle(id); showSuccess('Removed from shelf') }
    else { await saveArticle(id); showSuccess('On the shelf') }
  } catch { showError('Could not update the shelf') }
}

async function elevateAction() {
  if (elevating.value) return
  elevating.value = true
  try {
    await elevate(id)
    markAsRead(id, true).catch(() => {})
    showSuccess('Elevated to SFL')
  } catch {
    showError('Could not reach SFL')
  } finally {
    elevating.value = false
  }
}

function openOriginal() {
  if (article.value?.url) window.open(article.value.url, '_blank', 'noopener')
}

function onKey(e: KeyboardEvent) {
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
  if (e.key === 'Escape' || e.key === 'Backspace') { e.preventDefault(); goBack() }
  else if (e.key === 's') toggleSaveAction()
  else if (e.key === 'e') elevateAction()
  else if (e.key === 'v') openOriginal()
}
onMounted(() => window.addEventListener('keydown', onKey))
onUnmounted(() => window.removeEventListener('keydown', onKey))
</script>
```

Note: `GET /api/articles/:id` returns the article object directly (not `{article: ...}`) — fields `id, title, url, content, summary, imageUrl, author, publishedAt, isRead, readAt, feedId, feedTitle` (see `server/api/articles/[id].get.ts:69`). `fetch-fulltext` returns `{status, error}` and stores content server-side — hence the re-GET.

- [ ] **Step 2: Verify and commit**

Run: `npm run build && npx jest`
Expected: PASS / PASS. Manual check in dev: open a card → serif column, thin article triggers the full-text fetch, Original opens the source.

```bash
git add 'pages/article/[id].vue'
git commit -m "Rebuild the reader: serif column, quiet actions, fulltext-on-open"
```

---

## Task 9: Elevate to SFL

**Files:**
- Create: `server/utils/sfl.ts`, `server/api/articles/[id]/elevate.post.ts`, `server/api/articles/[id]/elevate.delete.ts`
- Modify: `composables/useElevate.ts` (replace stub), `nuxt.config.ts` (runtimeConfig), `.env.example`, `wrangler.toml`

- [ ] **Step 1: Add runtime config**

In `nuxt.config.ts`:

```ts
  runtimeConfig: {
    sflApiUrl: '',  // NUXT_SFL_API_URL
    sflApiKey: '',  // NUXT_SFL_API_KEY
  },
```

In `.env.example` append:

```bash
# SFL elevate (swipe-up sends articles into the SFL idea tracker)
NUXT_SFL_API_URL="https://sfl-api.aiwdm.workers.dev"
NUXT_SFL_API_KEY="..."
```

In `wrangler.toml` append:

```toml
[vars]
NUXT_SFL_API_URL = "https://sfl-api.aiwdm.workers.dev"
```

- [ ] **Step 2: Create `server/utils/sfl.ts`**

```ts
/**
 * Minimal SFL API client for the elevate flow.
 *
 * SFL dedupes page ideas by URL: POST with an existing URL returns
 * `{existing: true, idea}` instead of creating — callers must treat
 * `existing` ideas as not-ours-to-delete on undo.
 */

interface SflConfig {
  url: string
  key: string
}

export function getSflConfig(): SflConfig {
  const config = useRuntimeConfig()
  if (!config.sflApiUrl || !config.sflApiKey) {
    throw createError({ statusCode: 503, statusMessage: 'SFL is not configured' })
  }
  return { url: config.sflApiUrl, key: config.sflApiKey }
}

export async function createPageIdea(
  cfg: SflConfig,
  page: { url: string; title: string },
): Promise<{ ideaId: string; existing: boolean }> {
  const res = await fetch(`${cfg.url}/api/ideas`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${cfg.key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ type: 'page', title: page.title, url: page.url }),
  })
  if (!res.ok) {
    throw createError({ statusCode: 502, statusMessage: `SFL create failed (${res.status})` })
  }
  const body = await res.json() as { idea: { id: string }; existing?: boolean }
  return { ideaId: body.idea.id, existing: Boolean(body.existing) }
}

export async function deleteIdea(cfg: SflConfig, ideaId: string): Promise<void> {
  const res = await fetch(`${cfg.url}/api/ideas/${encodeURIComponent(ideaId)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${cfg.key}` },
  })
  if (!res.ok && res.status !== 404) {
    throw createError({ statusCode: 502, statusMessage: `SFL delete failed (${res.status})` })
  }
}
```

- [ ] **Step 3: Create `server/api/articles/[id]/elevate.post.ts`**

```ts
import { getAuthenticatedUser } from '~/server/utils/auth'
import { getD1 } from '~/server/utils/cloudflare'
import { getSflConfig, createPageIdea } from '~/server/utils/sfl'

/**
 * Elevate an article into the SFL knowledge pipeline: create a page idea in
 * SFL (which sleeper-articles polls and folds into thoughts/wiki), and mark
 * the article read locally. NOT optimistic — the client keeps the card if
 * this fails.
 */
export default defineEventHandler(async (event) => {
  const user = await getAuthenticatedUser(event)

  const articleId = parseInt(getRouterParam(event, 'id') || '')
  if (isNaN(articleId)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid article ID' })
  }

  const db = getD1(event)
  const article = await db.prepare(
    `
    SELECT a.id, a.title, a.url
    FROM "Article" a
    JOIN "Feed" f ON f.id = a.feed_id
    WHERE a.id = ? AND f.user_id = ?
    `
  ).bind(articleId, user.id).first<{ id: number; title: string; url: string }>()

  if (!article) {
    throw createError({ statusCode: 404, statusMessage: 'Article not found' })
  }

  const { ideaId, existing } = await createPageIdea(getSflConfig(), {
    url: article.url,
    title: article.title,
  })

  await db.prepare(
    `UPDATE "Article" SET is_read = 1, read_at = ? WHERE id = ?`
  ).bind(new Date().toISOString(), articleId).run()

  return { success: true, ideaId, existing }
})
```

(Before writing, check `server/api/articles/[id]/read.patch.ts` for the exact column names used to mark read — mirror them; if it also bumps a feed unread counter or similar, mirror that too.)

- [ ] **Step 4: Create `server/api/articles/[id]/elevate.delete.ts`** (the undo)

```ts
import { getAuthenticatedUser } from '~/server/utils/auth'
import { getD1 } from '~/server/utils/cloudflare'
import { getSflConfig, deleteIdea } from '~/server/utils/sfl'

/**
 * Undo an elevate: delete the SFL idea that the elevate created (only when
 * it actually created one — `existing` ideas predate the elevate and are
 * not ours to delete) and mark the article unread.
 */
export default defineEventHandler(async (event) => {
  const user = await getAuthenticatedUser(event)

  const articleId = parseInt(getRouterParam(event, 'id') || '')
  if (isNaN(articleId)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid article ID' })
  }

  const body = await readBody<{ ideaId?: string; existing?: boolean }>(event)

  const db = getD1(event)
  const article = await db.prepare(
    `
    SELECT a.id
    FROM "Article" a
    JOIN "Feed" f ON f.id = a.feed_id
    WHERE a.id = ? AND f.user_id = ?
    `
  ).bind(articleId, user.id).first()

  if (!article) {
    throw createError({ statusCode: 404, statusMessage: 'Article not found' })
  }

  if (body?.ideaId && !body.existing) {
    await deleteIdea(getSflConfig(), body.ideaId)
  }

  await db.prepare(
    `UPDATE "Article" SET is_read = 0, read_at = NULL WHERE id = ?`
  ).bind(articleId).run()

  return { success: true }
})
```

- [ ] **Step 5: Replace the `composables/useElevate.ts` stub**

```ts
export const useElevate = () => {
  const elevate = async (articleId: number): Promise<{ ideaId: string; existing: boolean }> => {
    const res = await $fetch<{ ideaId: string; existing: boolean }>(
      `/api/articles/${articleId}/elevate`,
      { method: 'POST' },
    )
    return res
  }

  const unElevate = async (articleId: number, ideaId?: string, existing?: boolean) => {
    await $fetch(`/api/articles/${articleId}/elevate`, {
      method: 'DELETE',
      body: { ideaId, existing },
    })
  }

  return { elevate, unElevate }
}
```

- [ ] **Step 6: Set the dev secret and verify end-to-end**

- Add `NUXT_SFL_API_URL` and `NUXT_SFL_API_KEY` to `.env.local` (key from `~/.config/sfl/config.json` → `SFL_API_KEY` field — read it locally, do not commit).
- Run `npm run dev`, swipe a card up (or press `↑`), then check the idea landed:
  `sfl search "<article title words>"` or `curl -s -H "Authorization: Bearer $KEY" "https://sfl-api.aiwdm.workers.dev/api/ideas?type=page&limit=3"`.
- Press `u` within the toast window; verify the idea is gone again.
- Production secret (one-time, note it in the PR/commit message): `npx wrangler secret put NUXT_SFL_API_KEY`.

- [ ] **Step 7: Run tests + build, commit**

Run: `npx jest && npm run build`
Expected: PASS / PASS (CardStack tests already cover elevate wiring against the composable interface).

```bash
git add -A
git commit -m "Add SFL elevate: create page idea on swipe-up, delete-on-undo"
```

---

## Task 10: The shelf

**Files:**
- Modify: `pages/shelf.vue` (replace stub)

- [ ] **Step 1: Rewrite `pages/shelf.vue`**

```vue
<template>
  <main class="mx-auto max-w-measure px-5 py-6 pb-20">
    <header class="flex items-baseline justify-between">
      <MonoLabel dash>Shelf</MonoLabel>
      <MonoLabel>{{ articles.length }} saved</MonoLabel>
    </header>
    <HairlineRule class="mt-3" />

    <!-- Flat tag filter -->
    <div v-if="tags.length" class="flex flex-wrap gap-x-4 gap-y-2 py-3">
      <button
        v-for="t in ['', ...tags]"
        :key="t || '__all__'"
        class="font-mono uppercase"
        style="font-size: 10px; letter-spacing: 0.16em;"
        :class="activeTag === t ? 'text-accent-ink' : 'text-mute'"
        @click="setTag(t)"
      >{{ t || 'All' }}</button>
    </div>
    <HairlineRule v-if="tags.length" />

    <p v-if="loading" class="mt-8 italic text-mute">Loading…</p>
    <p v-else-if="articles.length === 0" class="mt-8 italic text-mute">
      Nothing on the shelf yet — swipe a card left when something touches you.
    </p>

    <ul v-else>
      <li v-for="a in articles" :key="a.id" class="border-b border-rule py-4">
        <NuxtLink :to="`/article/${a.id}`" class="block">
          <div class="flex items-baseline justify-between gap-4">
            <MonoLabel dash>{{ a.feedTitle }}</MonoLabel>
            <MonoLabel>{{ a.publishedAt ? formatRelativeDate(a.publishedAt) : '' }}</MonoLabel>
          </div>
          <h2 class="mt-1 text-xl leading-snug text-ink">{{ a.title }}</h2>
          <p class="mt-1 text-sm text-mute">{{ excerpt(a.content || a.summary, 140) }}</p>
        </NuxtLink>
        <div class="mt-2 flex items-center justify-between">
          <div class="flex flex-wrap gap-x-3">
            <MonoLabel v-for="t in a.tags || []" :key="t">{{ t }}</MonoLabel>
          </div>
          <button
            class="font-mono uppercase text-mute hover:text-accent-ink"
            style="font-size: 10px; letter-spacing: 0.16em;"
            @click="remove(a.id)"
          >&mdash; Remove</button>
        </div>
      </li>
    </ul>
  </main>
</template>

<script setup lang="ts">
import type { Article } from '~/types'
import { excerpt } from '~/utils/cardData'
import { formatRelativeDate } from '~/utils/formatDate'

const { unsaveArticle } = useSavedArticles()
const { showError, showSuccess } = useToast()

const articles = ref<Article[]>([])
const loading = ref(true)
const activeTag = ref('')

const tags = computed(() => {
  const set = new Set<string>()
  for (const a of articles.value) for (const t of a.tags || []) set.add(t)
  return Array.from(set).sort()
})

async function load(tag = '') {
  loading.value = true
  try {
    const params: Record<string, string> = {}
    if (tag) params.tag = tag
    const res = await $fetch<{ articles: Article[] }>('/api/saved-articles', { params })
    articles.value = res.articles
  } catch {
    showError('Could not load the shelf')
  } finally {
    loading.value = false
  }
}

function setTag(t: string) {
  activeTag.value = t
  load(t)
}

async function remove(id: number) {
  try {
    await unsaveArticle(id)
    articles.value = articles.value.filter((a) => a.id !== id)
    showSuccess('Removed from shelf')
  } catch {
    showError('Could not remove')
  }
}

onMounted(() => load())
</script>
```

(Note: the tag list derives from the unfiltered load; when a tag filter is active the chips persist because `tags` is computed from the current page — acceptable for v1. Per-row tag *editing* is dropped from v1: tags flow in from feed tags on save, and `PATCH /api/saved-articles/:id/tags` remains available to the MCP tools. This is a deliberate YAGNI cut from the spec's "edit tags" mention — flag it in the PR description.)

- [ ] **Step 2: Verify and commit**

Run: `npm run build && npx jest` → PASS / PASS. Manual: save a card on the deck, see it on the shelf, filter by tag, remove it.

```bash
git add pages/shelf.vue
git commit -m "Add the shelf: hairline rows, flat tag filter"
```

---

## Task 11: Sources

**Files:**
- Modify: `pages/sources.vue` (replace stub)

- [ ] **Step 1: Rewrite `pages/sources.vue`**

```vue
<template>
  <main class="mx-auto max-w-measure px-5 py-6 pb-24">
    <header class="flex items-baseline justify-between">
      <MonoLabel dash>Sources</MonoLabel>
      <MonoLabel>{{ feeds.length }} feeds</MonoLabel>
    </header>
    <HairlineRule class="mt-3 mb-5" />

    <!-- Add feed -->
    <form class="flex items-end gap-3" @submit.prevent="add">
      <div class="flex-1">
        <MonoLabel>Add a feed</MonoLabel>
        <input
          v-model="newUrl" type="url" placeholder="https://…"
          class="w-full border-0 border-b border-rule bg-transparent py-1.5 text-ink outline-none focus:border-accent"
        />
      </div>
      <ActionLabel accent :disabled="adding || !newUrl" @click="add">
        {{ adding ? 'Adding…' : 'Add' }}
      </ActionLabel>
    </form>

    <!-- Grouped feed list -->
    <section v-for="(group, tag) in feedsByTag" :key="tag" class="mt-8">
      <MonoLabel dash>{{ tag === '__inbox__' ? 'Inbox' : tag }}</MonoLabel>
      <ul class="mt-1">
        <li v-for="feed in group" :key="feed.id" class="border-b border-rule py-3">
          <div class="flex items-baseline justify-between gap-3">
            <span class="min-w-0 truncate text-lg text-ink">{{ feed.title }}</span>
            <MonoLabel>{{ feed.unreadCount }}</MonoLabel>
          </div>
          <div class="mt-1.5 flex gap-4">
            <button class="src-action" @click="markRead(feed.id)">Mark read</button>
            <button class="src-action" @click="editTags(feed)">Tags</button>
            <button class="src-action hover:text-accent-ink" @click="confirmDelete(feed)">Delete</button>
          </div>
        </li>
      </ul>
    </section>

    <!-- Footer -->
    <HairlineRule class="mt-10" />
    <footer class="mt-4 flex flex-wrap items-center justify-between gap-3">
      <ActionLabel :disabled="syncing" @click="sync">{{ syncing ? 'Syncing…' : 'Sync all' }}</ActionLabel>
      <div class="flex items-center gap-4">
        <NuxtLink to="/mcp-settings"><MonoLabel>MCP</MonoLabel></NuxtLink>
        <template v-if="user">
          <MonoLabel>{{ user.email }}</MonoLabel>
          <button class="src-action" @click="signOutAction">Sign out</button>
        </template>
        <NuxtLink v-else to="/login"><MonoLabel accent>Sign in</MonoLabel></NuxtLink>
      </div>
    </footer>
  </main>
</template>

<script setup lang="ts">
import type { Feed } from '~/types'

const { feeds, feedsByTag, fetchFeeds, addFeed, deleteFeed, syncAll, updateFeedTags } = useFeeds()
const { markAllAsRead, fetchArticles } = useArticles()
const { user, signOut } = useAuth()
const { showSuccess, showError } = useToast()

const newUrl = ref('')
const adding = ref(false)
const syncing = ref(false)

onMounted(() => fetchFeeds())

async function add() {
  if (!newUrl.value || adding.value) return
  adding.value = true
  try {
    const res = await addFeed(newUrl.value)
    showSuccess(`Added — ${res.articlesAdded} articles`)
    newUrl.value = ''
  } catch (err: any) {
    showError(err.data?.message || 'Could not add that feed')
  } finally {
    adding.value = false
  }
}

async function markRead(feedId: number) {
  try {
    await markAllAsRead(feedId)
    await fetchFeeds()
    showSuccess('Marked read')
  } catch { showError('Failed to mark read') }
}

async function editTags(feed: Feed) {
  const input = window.prompt('Tags (comma-separated)', feed.tags.join(', '))
  if (input === null) return
  const tags = input.split(',').map((t) => t.trim()).filter(Boolean)
  try {
    await updateFeedTags(feed.id, tags)
    showSuccess('Tags updated')
  } catch { showError('Failed to update tags') }
}

async function confirmDelete(feed: Feed) {
  if (!window.confirm(`Delete "${feed.title}" and all its articles?`)) return
  try {
    await deleteFeed(feed.id)
    showSuccess('Feed deleted')
  } catch { showError('Failed to delete feed') }
}

async function sync() {
  syncing.value = true
  try {
    await syncAll()
    await fetchArticles()
    showSuccess('All feeds synced')
  } catch { showError('Sync failed') }
  finally { syncing.value = false }
}

async function signOutAction() {
  await signOut()
  navigateTo('/login')
}
</script>

<style scoped>
.src-action {
  font-family: 'SF Mono', ui-monospace, Menlo, monospace;
  font-size: 10px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--text-muted);
}
.src-action:hover { color: var(--text-strong); }
</style>
```

(Check `composables/useAuth.ts` for the actual exports — `user`, `signOut`, `loggedIn`; adjust names if they differ. `window.prompt`/`window.confirm` for tags/delete is the deliberate v1 — no modal component, no dropdown menus, per the declutter mandate.)

- [ ] **Step 2: Verify and commit**

Run: `npm run build && npx jest` → PASS / PASS. Manual: add a feed (with discovery via `POST /api/feeds` — it discovers internally), retag it, mark read, delete it, sync all, sign out/in.

```bash
git add pages/sources.vue
git commit -m "Add sources room: add/manage feeds, account footer"
```

---

## Task 12: Help overlay, PWA polish, docs, ship

**Files:**
- Create: `components/HelpOverlay.vue`
- Modify: `pages/index.vue` (wire `?`), `nuxt.config.ts` (PWA colors/names), `CLAUDE.md`

- [ ] **Step 1: Create `components/HelpOverlay.vue`**

```vue
<template>
  <Teleport to="body">
    <div v-if="open" class="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-5" @click.self="emit('close')">
      <CardFrame class="w-full max-w-sm p-6">
        <MonoLabel dash>Keys</MonoLabel>
        <table class="mt-4 w-full text-sm">
          <tbody>
            <tr v-for="row in keys" :key="row[0]" class="border-b border-rule last:border-0">
              <td class="py-1.5 pr-4 font-mono text-mute" style="font-size: 11px;">{{ row[0] }}</td>
              <td class="py-1.5 text-body">{{ row[1] }}</td>
            </tr>
          </tbody>
        </table>
        <div class="mt-5 text-right">
          <ActionLabel @click="emit('close')">Close</ActionLabel>
        </div>
      </CardFrame>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: [] }>()

const keys = [
  ['←', 'Save to the shelf'],
  ['→', 'Mark read'],
  ['↑', 'Elevate to SFL'],
  ['↓', 'Skip — back of the deck'],
  ['o / Enter / tap', 'Open the reader'],
  ['u', 'Undo the last verb'],
  ['shift + r', 'Sync all feeds'],
  ['esc (reader)', 'Back'],
  ['s / e / v (reader)', 'Save · Elevate · Original'],
  ['?', 'This card'],
]
</script>
```

- [ ] **Step 2: Wire `?`, `o`, and `shift+r` in `pages/index.vue`**

Add to the template (after `</div>` of the stack container): `<HelpOverlay :open="helpOpen" @close="helpOpen = false" />`

In the script, add `const helpOpen = ref(false)` and extend `onKey`:

```ts
  } else if (e.key === 'u') {
    stack.value?.undo()
  } else if (e.key === '?') {
    helpOpen.value = !helpOpen.value
  } else if (e.key === 'o' || e.key === 'Enter') {
    const top = deckArticles.value[0]
    if (top) navigateTo(`/article/${top.id}`)
  } else if (e.key === 'R' && e.shiftKey) {
    syncAll()
  }
```

- [ ] **Step 3: PWA manifest polish in `nuxt.config.ts`**

In the `pwa.manifest` block set:

```ts
      name: 'The Reader',
      short_name: 'Reader',
      description: 'A calm reading room',
      theme_color: '#fbf9f4',
      background_color: '#fbf9f4',
```

Also delete the two Google-Fonts `runtimeCaching` entries in `pwa.workbox` (fonts are self-hosted now).

- [ ] **Step 4: Update `CLAUDE.md`**

Rewrite the UX-related sections to match reality (this is a documentation-policy requirement, not optional):
- Replace the "Almanac Design System & Card-Stack Reader" section with a "Tufte Viz Design System & Card Deck" section: vendoring (`public/tufte/`, `assets/css/tufte.css`, `config/tufte.preset.cjs`), the three rooms, the five verbs incl. elevate, `motion-v` physics, `utils/deck.ts` + `utils/cardData.ts`.
- Update "Component Organization" (tufte primitives, stack components, BottomBar, HelpOverlay, AppToast), "Keyboard Shortcuts", "AI Features" (now: none — section becomes "Removed surfaces" one-liner), "API Routes" (drop summarize/tag-summary/claude/unsplash; add elevate POST/DELETE), "Environment Variables" (drop OpenAI/Anthropic; add `NUXT_SFL_API_URL`/`NUXT_SFL_API_KEY`), "State Management" (drop deleted composables, add `useElevate`).

- [ ] **Step 5: Final verification**

```bash
npx jest                  # all suites green
npm run build             # production build green
npm run dev               # manual pass: deck feel on a phone, all five verbs,
                          # undo (incl. elevate), reader, shelf, sources, login,
                          # mcp-settings, help overlay, dark mode via OS toggle
```

- [ ] **Step 6: Commit and ship**

```bash
git add -A
git commit -m "Add help overlay, PWA polish, and rebuilt-UX docs"
git push   # CI deploys to reader.phareim.no via wrangler on push to main
```

After CI completes: open `https://reader.phareim.no` on the phone, confirm the deploy, and confirm the production elevate works once `NUXT_SFL_API_KEY` is set (Task 9 Step 6).

---

## Self-review notes (already applied)

- **Spec coverage**: §1 foundation→T1; §2 rooms→T1/T2/T10/T11; §3 deck→T4/T7; §4 card→T5/T6; §5 reader→T8; §6 elevate→T9; §7 shelf→T10 (with one flagged YAGNI cut: per-row tag editing); §8 sources→T11; §9 teardown→T2/T3; §10 keys→T7/T8/T12; §11 testing→T4/T5/T7; §12 out-of-scope respected.
- **Known judgment calls encoded above**: elevate is non-optimistic; undo-of-elevate only deletes non-`existing` ideas; legacy Unsplash URLs filtered client-side; `useToast` converted to `useState`; motion-v mocked (not transformed) under Jest.
- **Verify-don't-trust points for the executor** (marked inline): `formatRelativeDate` export name, `useAuth` export names, exact mark-read column names in `read.patch.ts`, favicon/Unsplash residue in `feedParser.ts`.
