# Almanac UX Rebuild — Design Spec

**Date:** 2026-06-05
**Status:** Approved, building
**Scope:** Ground-up reskin of the entire Reader UX into the Almanac design system, with a new card-stack reading entrance.

This document is the shared contract for every agent building this. Read it fully before touching code. The data layer (composables + API) does NOT change — this is a pure UX/skin rebuild.

---

## 0. Design system: Almanac

Canonical spec lives at `~/github/almanac-design/DESIGN.md`. The five rules:

1. **Hairline, not box** — 1px rules, never card-shadow, never border-radius.
2. **Accent only at attention** — exactly one rust (light) / amber (dark) moment per screen.
3. **Serif body always** — Source Serif 4 → Georgia fallback. Never sans for prose.
4. **Stars dark-mode only** — six static hand-placed dots, no animation.
5. **No chrome** — no gradients beyond the night sky, no shadows, no rounded buttons, no multi-accent.

**Palette (light):** paper `#f4f0e8`, ink `#1a1a1a`, mute `#6a6a6a`, rust `#c14a2a`, rule `#d8d2c4`.
**Palette (dark):** gradient `#161b24`→`#0e1219`, ink `#ebe4d4`, mute `#7a8a9a`, amber `#d4a574` (`text-shadow 0 0 4px rgba(212,165,116,0.25)` on labels/glyph dot), rule `rgba(255,255,255,0.10)`.

**Type:** Source Serif 4 / Georgia. Headline 26px (line 1.20, tracking -0.012em). Body 14px (line 1.55, max 65ch). Italic 13px. MonoLabel: 9px SF Mono uppercase, tracking 0.16em, with a leading `— ` em-dash.

**Space:** gutter 22px, sectionGap 14px, hairline 1px.

**Affordances:** there are NO Almanac buttons/cards/inputs/modals. Action affordances = a `MonoLabel` with a hairline border. Sections separate with hairline dividers, not boxes.

---

## 1. Foundation (Phase 1 — single agent, barrier)

The Phase-1 agent owns ALL shared config. No Phase-2 agent may touch these files.

**Owned files:** `tailwind.config.js`, `app.vue`, `nuxt.config.ts`, `assets/css/*` (new), `public/almanac/**` (vendored), `components/almanac/*` (new primitives), `composables/useDeckGesture.ts` (new), `utils/deck.ts` (new pure logic).

### 1.1 Vendor the design system
Run from the repo root (`$ALMANAC` = `~/github/almanac-design`):
```bash
ALMANAC=~/github/almanac-design
mkdir -p public/almanac
cp -r "$ALMANAC/tokens"          public/almanac/
cp -r "$ALMANAC/components/web"  public/almanac/components-web
cp -r "$ALMANAC/assets"          public/almanac/
```
Result: `public/almanac/tokens/tokens.css`, `public/almanac/components-web/almanac.css`, `public/almanac/components-web/{OrbitalGlyph,Starfield}.svg`, `public/almanac/fonts/source-serif-4-variable.woff2` (+ italic).

### 1.2 Fonts
Add an `assets/css/almanac.css` (imported globally via `nuxt.config.ts` `css: [...]`) with `@font-face` for Source Serif 4 (regular + italic) pointing at `/almanac/fonts/...woff2`, `font-display: swap`, and the italic variant. Establish the serif + mono-label font stacks as CSS vars / Tailwind theme.

### 1.3 Tailwind preset + tokens
- Add `require('./public/almanac/tokens/tailwind.preset.cjs')` to `tailwind.config.js` `presets: [...]` (copy the preset into the repo if the path is awkward under `public/`; prefer a repo-local copy at `config/almanac.preset.cjs`). After this, these utilities MUST exist and be used everywhere: `bg-paper`, `text-ink`, `text-mute`, `text-rust` (accent), `border-rule`, `font-serif`, plus a `mono-label` utility/class.
- Keep `darkMode: 'media'`. The vendored `tokens.css` drives the dark palette; ensure the dark palette applies under `@media (prefers-color-scheme: dark)` (adapt the `[data-theme=dark]` selector to also fire under the media query). Set `data-theme` on `<html>` in `app.vue` for completeness but DO NOT build a manual toggle.
- Replace the old `dark-bg`/blue-accent usages at the token level so downstream pages inherit the new palette.

### 1.4 Global page chrome (`app.vue`)
- `bg-paper text-ink font-serif`, min-h-screen.
- Dark mode: render the `Starfield` (six static dots) behind content — dark only, `aria-hidden`.
- Link the vendored `tokens.css` + `components-web/almanac.css` (via `nuxt.config.ts` `app.head.link` or `css`).

### 1.5 Shared Vue primitives (`components/almanac/`)
All auto-imported. Keep each tiny and presentational.
- **`MonoLabel.vue`** — slot text rendered as the 9px tracked uppercase mono label with leading em-dash. Prop `as` (span/h-) optional.
- **`SerifHeadline.vue`** — 26px serif headline, prop `level` (h1/h2/h3) for size scaling.
- **`SectionDivider.vue`** / **`HeaderDivider.vue`** — hairline `<hr>` (rule color), header variant slightly heavier weight per DESIGN.md.
- **`PaperPanel.vue`** — a hairline-framed paper surface (1px `border-rule`, no shadow, no radius). The card-stack and modals compose this.
- **`OrbitalGlyph.vue`** — wraps the vendored `OrbitalGlyph.svg` (the glyph dot gets the amber glow in dark).
- **`Starfield.vue`** — wraps `Starfield.svg`, renders only in dark.
- **`ActionLabel.vue`** — a `MonoLabel` inside a hairline border = the Almanac substitute for a button. Props: `label`, `accent?` (bool → rust/amber), emits `click`. Use this EVERYWHERE a button is needed.

### 1.6 Deck gesture + logic (shared by stack + reader)
- **`utils/deck.ts`** (pure, unit-tested): deck state machine.
  - `resolveDirection(dx, dy, threshold)` → `'left'|'right'|'up'|'down'|null`.
  - `advance(deck, action)` and `undo(history)` pure reducers over an array of article ids. `down`/skip moves the top id to the back; `left`/`right`/commit removes it; history records `{id, action, prevIndex}` for undo.
  - Reuse the existing `SWIPE_CONFIG` ratios from `composables/useSwipeGesture.ts` (MIN_DISTANCE_RATIO 0.67, dominance, etc.).
- **`composables/useDeckGesture.ts`**: pointer/touch drag where the top card follows the finger (`translateX/translateY` + slight `rotate` proportional to dx + opacity on the action hint). Supports all four directions. On release past threshold → `onCommit(direction)`; else spring back. Also exposes a `commit(direction)` method so keyboard + on-screen `ActionLabel`s drive the same path. Element-level listeners (not window-level — the existing `useSwipeGesture` is window-level for nav; this is a new, card-scoped composable).

---

## 2. Card stack — the entrance (Phase 2, Agent A)

**Owned files:** `pages/index.vue` (rewrite), `components/stack/CardStack.vue` (new), `components/stack/ArticleStackCard.vue` (new), `components/stack/DeckEmptyState.vue` (new), `components/stack/UndoToast.vue` (new).

- **Source:** all unread articles, newest first, via `useArticles().fetchArticles()` (no feed arg). When the menu sets `selectedFeedId`/`selectedTag`, the deck refills from that selection (watch, same as today's index.vue logic).
- **`CardStack.vue`:** holds the id deck; renders the top 3 cards. Cards 2 & 3 peek below with a few-px downward offset + reduced opacity (`text-mute`/lower opacity), each its own hairline `PaperPanel` frame — *paper sheets, never floating cards*. Wires `useDeckGesture` to the top card only.
- **`ArticleStackCard.vue`:** `PaperPanel` containing `MonoLabel` source (`article.feedTitle`), `SerifHeadline` (`article.title`), hero image (`article.imageUrl`, fallback: none → omit gracefully), 3-line clamped serif excerpt (`article.summary` || stripped `article.content`). Bound to the gesture transform. During drag, reveal ONE accent edge on the leading side + the pending `ActionLabel`: `— STORE` (left), `— READ` (right), `— OPEN` (up), `— SKIP` (down).
- **Commit actions:**
  - left → `useSavedArticles().save` (POST `/api/articles/:id/save`) then `advance`.
  - right → `useArticles().markAsRead(id, true)` (PATCH `/api/articles/:id/read`) then `advance`.
  - up → navigate to `/article/:id` (reader). Non-destructive; card stays in deck.
  - down → skip: `advance` moves id to back of deck. No API call.
- **`UndoToast.vue`:** appears ~5s after a left/right commit. `ActionLabel` `— UNDO`. Undo reverses the API call (unsave / mark-unread) and restores the card to top via `deck.undo`. Keyboard `u` triggers it.
- **`DeckEmptyState.vue`:** when deck empty → centered `OrbitalGlyph` + serif "You're all caught up." + a `— SYNC ALL` action.
- **Keyboard (desktop):** `←→↑↓` = store/read/open/skip, `u` = undo, `Enter`/click = open. Integrate via the keyboard agent (Agent E owns `useKeyboardShortcuts`); Agent A exposes the `commit`/`undo` handlers the shortcuts call.
- Preserve the not-logged-in entrance (today's `pages/index.vue` shows a sign-in CTA) — reskinned: paper + serif + one rust `— SIGN IN` action, starfield in dark.

---

## 3. Reader (Phase 2, Agent B)

**Owned files:** `pages/article/[id].vue` (rewrite).

Full-screen serif reader: `MonoLabel` `— {feedTitle} · {relative date}`, `SerifHeadline` title, `HeaderDivider`, hero image, then DOMPurify-sanitized prose. Prose styling: serif, 65ch max, `text-ink`, rust links, hairline `<hr>`, blockquotes with a hairline left rule. Reuse `utils/processArticleContent.ts` + client-side `DOMPurify.sanitize()` (keep the existing sanitize pattern). The four actions available as `ActionLabel`s in a hairline footer AND via swipe (reuse `useDeckGesture` for the single-card case, or the existing `useSwipeGesture` for left/right). `formatRelativeDate()` from `utils/formatDate.ts` for the date. Keep the existing prev/next swipe-navigation behavior if feasible, restyled.

---

## 4. Shell (Phase 2, Agent C)

**Owned files:** `components/layout/PageHeader.vue`, `components/layout/PageHeaderMenu.vue`, `components/layout/HamburgerMenu.vue`, `components/menu/*` (MenuHeader, AddFeedSection, SavedArticlesSection, FeedsSection, FeedDropdownMenu, BottomActions), `components/SwipeIndicator.vue` (restyle accent to rust/amber).

- **Header:** a `HeaderDivider` hairline, `MonoLabel` context (feed/tag name or "— ALL UNREAD"), unread count in mute. Actions as `ActionLabel`s, never boxy buttons. No blue.
- **Slide-in menu:** `bg-paper`, hairline dividers between sections, `MonoLabel` section headers (`— FEEDS`, `— SAVED`, `— TAGS`, `— INBOX`), serif feed titles, counts in mute, rust/amber only on the active feed/tag. Dropdown menus = hairline-framed paper, no shadow/radius.
- **`SwipeIndicator.vue`:** swap the blue (`rgb(59,130,246)`) glow for the rust/amber accent token.

---

## 5. List pages (Phase 2, Agent D)

**Owned files:** `pages/saved.vue`, `pages/feed/[id].vue`, `pages/tag/[name].vue`, `components/article/ArticleCard.vue`, `components/article/ArticleActionsMenu.vue`, `components/common/ArticleCardSkeleton.vue`.

These keep the list/column model (they are NOT the card stack). Reskin to an Almanac **reading column**: hairline-separated article rows, `MonoLabel` source, `SerifHeadline` (h3) title, mute meta, serif excerpt, rust-on-hover/active. `ArticleCard` row: no shadow/radius; separate rows with `SectionDivider`. Actions menu = hairline paper popover. Skeleton = hairline shimmer in mute, no rounded boxes.

---

## 6. Auth + common (Phase 2, Agent E)

**Owned files:** `pages/login.vue`, `pages/mcp-settings.vue`, `components/common/EmptyState.vue`, `components/common/KeyboardShortcutsHelp.vue`, `components/common/BulkActionBar.vue`, `components/common/NewsletterModal.vue`, `components/common/TagInput.vue`, `components/feed/FeedUrlInput.vue`, `components/PwaUpdatePrompt.vue`, `composables/useKeyboardShortcuts.ts` (extend for deck shortcuts).

- **`login.vue`:** centered paper, `OrbitalGlyph`, serif welcome, email/password as hairline-underlined inputs (label = `MonoLabel`), one rust `— SIGN IN` action. Starfield in dark.
- **Modals** (`NewsletterModal`, `KeyboardShortcutsHelp`): `PaperPanel` over a paper scrim, hairline-framed, no radius/shadow. `KeyboardShortcutsHelp` MUST document the new deck keys (`←→↑↓`, `u`).
- **`BulkActionBar`:** hairline top rule, `ActionLabel`s, accent only on the primary action.
- **Inputs** (`TagInput`, `FeedUrlInput`): hairline-underlined, no rounded boxes, mono-label captions.
- **`useKeyboardShortcuts`:** add `←→↑↓` (store/read/open/skip), `u` (undo) bound to handlers passed from the stack page; keep existing j/k/o/m/s/r shortcuts working on list pages.

---

## 7. Integration (Phase 3 — single agent, barrier)

- Run `npm run build`; fix every type/import/SSR error at the seams.
- Verify no remaining blue accents / rounded buttons / box-shadows in the touched files (grep for `blue-`, `rounded`, `shadow`, `bg-gray`, `dark-bg`).
- Ensure dark mode renders the gradient + starfield and the amber accent.
- Run `npm run test` (add/keep unit tests for `utils/deck.ts` and `useDeckGesture` direction resolution).
- Report what built, what failed, and any TODO seams.

---

## Non-goals (this pass)
- No API/schema/endpoint changes.
- No new feature logic beyond skip/undo deck mechanics.
- No manual dark/light toggle (system preference only).
- No backend AI on cards (excerpt only — AI-summary cards deferred).

## Verification checklist
- [ ] `npm run build` passes.
- [ ] `npm run test` passes.
- [ ] Card stack: all four gestures + undo work; deck refills on menu selection; empty state shows.
- [ ] Reader opens from card `↑`/tap; sanitized prose renders serif.
- [ ] Every page renders in both light and `prefers-color-scheme: dark`.
- [ ] No `blue-*`, `rounded-*` (buttons), `shadow-*`, `bg-gray-*`, `dark-bg` left in touched files.
