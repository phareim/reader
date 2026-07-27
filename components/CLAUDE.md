# Components

The whole surface is the **Tufte Viz design system** — warm paper, ET Book serif,
hairline rules, exactly one crimson accent per screen. Compose the Tufte primitives
rather than re-inventing labels, buttons, or rules.

Pages that mount these live in [`../pages/CLAUDE.md`](../pages/CLAUDE.md); the pure
logic behind them in [`../utils/CLAUDE.md`](../utils/CLAUDE.md).

## Organization

**Tufte primitives** (`components/tufte/`) — small presentational building blocks every surface composes. Auto-imported with **no path prefix** (configured in `nuxt.config.ts`), so they are `<MonoLabel>`, `<CardFrame>`, etc., NOT `<TufteMonoLabel>`:
- `MonoLabel.vue` - 10px tracked uppercase mono label; `dash` prop adds the leading em-dash (`— SECTION`), `accent` promotes it to the screen's one accent
- `ActionLabel.vue` - **the Tufte substitute for a button**: a bordered mono label, emits `click`; `accent` prop promotes it to the single crimson accent. Use this anywhere a button is needed
- `CardFrame.vue` - hairline-framed raised paper surface (no shadow, no radius) — deck cards, modals, and prompts compose this
- `HairlineRule.vue` - hairline `<hr>` (never boxes); `strong` prop for the heavier rule
- `FeedFavicon.vue` - a feed's tiny favicon (`Feed.favicon_url`, Google S2) beside its name — quiet per-feed differentiation on Sources rows, deck/grid cards, and shelf rows; renders nothing when the URL is missing or fails to load (`size` prop, default 12px)

**Card deck** (`components/stack/`) — the reading entrance:
- `CardStack.vue` - owns the deck state + motion-v physics, performs the five verbs, exposes `commit(direction)`, `undo()`, and `openTop()` to the page
- `ArticleCard.vue` - a single card (`CardFrame`): full-bleed hero with overlaid headline when an image exists, typographic head otherwise; excerpt + reading time
- `DeckEmptyState.vue` - "all caught up" + Sync all
- `UndoToast.vue` - brief `— UNDO <verb>` affordance after save/read/elevate

**Grid survey view** (`components/grid/`) — the deck's scrollable alternate, toggled from the deck header (see "Grid view" below):
- `ArticleGrid.vue` - vertically scrollable grid — single full-width column on phones (wider rows read + sort easier), 3-col ≥sm — bound to the **live** unread-and-unsaved list. Owns per-card horizontal swipes (`drag="x"` + `touch-action: pan-y` so vertical pans stay native scroll; **one MotionValue per card** (`xFor` map), so a committing card flings out on its own value and the next swipe starts immediately — commits on different cards overlap, only the same card is guarded via the `exiting` set), the commit path (← read / → save, optimistic, `resolveGridDirection` from `utils/grid.ts`), a grid-local LIFO undo history + `UndoToast`, tap→reader with the `movedFar` guard, a bottom **Mark all read** `ActionLabel` (emits `markAllRead`; `markingAll` prop shows the busy label — the parent owns the call), and the IntersectionObserver sentinel that emits `loadMore` (re-observed after each load so a still-visible sentinel fires again). Exposes `undo()` and `commitCard(id, dir)`; **no elevate and no prefetch** (deliberate — see the design notes in the Tufte section)
- `MiniCard.vue` - compact image-led card, responsive to the grid's column count: a horizontal row (fixed `w-28` side thumbnail left, text right) in the 1-col phone grid, stacked (`aspect-[4/3]` hero on top) ≥sm. Thumbnail via `cardImageUrl` (filler filtered) + 3-line headline + `feed · age` mono footer; typographic hairline-head variant when imageless. No excerpt — density is the point

**Shared chrome** (`components/`):
- `DeckScreen.vue` - the entire deck screen (snapshot, keyboard handler, sync, help overlay, and the **deck / grid view toggle**; its `<main>` is `fixed inset-0 overflow-hidden` — the screen contributes no document height, so the page itself never scrolls in deck mode (no iOS rubber-band or URL-bar creep) and grid mode scrolls inside ArticleGrid's own scroller — two mono text-buttons in the header, active word hairline-underlined, mode persisted via `useViewMode()`); optional `tag` prop scopes the deck to one tag and optional `feedId` (+ `title` for the header) scopes it to one feed; emits `not-found` when the tag/feed doesn't exist. In grid mode it mounts `ArticleGrid` on the live filtered list instead of CardStack, forwards `u` to the grid's undo, and leaves arrows/`o`/Enter native (no top card to act on)
- `BottomBar.vue` - fixed bottom room-switcher (Deck / Found / Shelf / Sources); hidden on `/article/*` and `/login`
- `AppToast.vue` - renders `useToast()` state. The visible toast is `aria-hidden`; announcement goes through two always-mounted `sr-only` live regions (polite for success, assertive for error) so a message lands in a node the screen reader is already observing — a live region inserted at the same moment as its text is announced unreliably
- `HelpOverlay.vue` - the `?` keyboard-shortcuts card (Teleport + `CardFrame`). The reader's keys live in one `readerKeys` array spread into both the deck and grid tables — **add a reader key here in the same commit that adds it to `pages/article/[id].vue`** (`r`, `g`, `w` and `l` all shipped without ever reaching this card). The list scrolls inside the card, since `CardFrame` clips overflow and the table outgrows a short screen
- `TagEditorOverlay.vue` - full-screen tag editor for a feed (Teleport paper sheet — `bg-paper`, no backdrop, no tap-to-dismiss): removable chips + input with autocomplete on existing tags (Enter/comma commit, arrows navigate suggestions, Backspace on empty input removes last chip, Esc cancels via its own window listener). Dumb overlay — takes `feed` + `allTags` props, emits `save(tags)` / `close`; the page owns the API call. Mount with `v-if` so draft state resets per open
- `HighlightNoteOverlay.vue` - full-screen note sheet for a fresh highlight (Teleport paper sheet, mirrors `TagEditorOverlay`): shows the quoted passage + a `<textarea>` for the optional note (`#tags` hint). `#hashtags` light up live as you type — the textarea's text is transparent over a `.note-mirror` div rendering `renderNoteHtml(draft)` (accent + text-shadow fake-bold, since a real weight change would drift the native caret; scroll kept in sync). Takes `quote` + `saving` props, emits `save(note)` / `close`; Cmd/Ctrl+Enter commits, Esc cancels. Mount with `v-if` so the draft resets per open
- `RsvpOverlay.vue` - full-screen RSVP speed-read sheet (Teleport paper sheet, opened from the reader's top action row or `w`): one word at a time with the ORP letter pinned to a fixed x (1fr|auto|1fr grid) as the screen's one accent, hairline progress rail, Slower/Faster/Play–Pause(/Restart)/Close `ActionLabel`s. Takes `words: string[]`, emits `close`; owns its keys while open (space play/pause, ←/→ skip ±10 words, ↑/↓ wpm ±25, Esc close) and tapping the word toggles play. Pure timing/ORP math in `utils/rsvp.ts`; wpm persisted in `localStorage['reader:rsvpWpm']`. Mount with `v-if` so it reopens at word 0
- `HighlightPopover.vue` - small Teleported `CardFrame` near a tapped mark: renders the note via `renderNoteHtml` (hashtags accent-styled) or "No note", a `— IN SFL` `MonoLabel` when synced, **X / Threads share buttons** (brand glyphs; share the marked passage in curly quotes + the article link via `xQuoteShareUrl` / `threadsQuoteShareUrl`, shown only when `sourceUrl` is set), and a **Remove** `ActionLabel`. Takes `highlight` + `x`/`y` (clamped into the viewport) + optional `sourceUrl`, emits `remove` / `close`
- `FeedPickerOverlay.vue` - full-screen picker shown when smart-add discovers **several** feeds at a URL (Teleport paper sheet, mirrors `TagEditorOverlay`): one hairline row per discovered feed (title + mono URL) with an accent Add per row; added rows flip to `— ADDED` so several can be subscribed in one visit; footer reads Cancel before any add, Done after; Esc closes. Dumb overlay — takes `feeds` + `addedUrls` + `busyUrl`, emits `add(feed)` / `close`; the Sources page owns the API calls. Mount with `v-if`
- `SaveArticleOverlay.vue` - full-screen prompt shown when smart-add lands on an article page instead of a feed (Teleport paper sheet): "No feed here" + the extracted title/author/URL/description, Cancel / accent Save-article footer, Esc closes. Dumb overlay — takes `article` + `saving`, emits `save` / `close`; the Sources page POSTs `/api/articles/manual` (which stores it in the "Manual Additions" feed **and saves it to the shelf**). Mount with `v-if`
- `PwaUpdatePrompt.vue` - service-worker update prompt


## Client-side patterns

**Toast Messages**: Use `useToast()` composable for success/error messages with auto-dismiss; `AppToast.vue` (mounted in `app.vue`) renders them. Do not use raw refs with setTimeout.

**Optimistic Updates**: Save, mark-read, and skip update local state immediately (elevate deliberately does not — see "The five verbs" below). When using `useState` with `Set`, always replace the Set (create a new one) rather than mutating in place, since Vue's reactivity doesn't track Set mutations.

**Deck prefetch (peek warming)**: `CardStack` watches the card directly *behind* the top one (`deckIds[1]`) and calls `useArticles().prefetchArticle(id)` as the deck shifts. That fires the full-text fetch in the background so, by the time the card is promoted or opened, its og:image has backfilled `imageUrl` (an imageless RSS card gains a picture in the peek) and its body is in R2 (opening is instant). It is deduped (a session `Set` in `useState`) and **gated** — skipped when the card already has a usable image (`cardImageUrl`) or its `fullTextStatus` is already `fetched`/`failed`/`skipped` — so it never spends a round-trip for nothing; hence the list endpoint (`GET /api/articles`) now returns `fullTextStatus` alongside the still-`null` `content`. Best-effort and fire-and-forget: a failure leaves the id in the deduped set (a flaky page isn't hammered on every shuffle) and the reader still fetches on open.

## Component communication

Components communicate via:
- **Props** - Parent to child data flow
- **Emits** - Child to parent events (e.g. CardStack's `@sync` / `@count`)
- **Composables** - Shared global state (preferred over prop drilling)
- **`defineExpose`** - The page drives CardStack imperatively (`commit` / `undo` / `openTop`) so keys and gestures share one path

## Styling notes

- **Tufte Viz aesthetic throughout** (see "Tufte Viz design system and the card deck" below): warm paper / dark paper, ET Book serif body, hairline 1px rules (never card shadows or rounded buttons), exactly **one crimson accent per screen** — during a drag that accent is the pending-verb label. The lone sanctioned exception is the **yellow highlighter** (`--highlight` token in `tufte.css`, `mark.hl` rule in `main.css`): a deliberate *second* mark colour for saved passages — crimson stays reserved for the active verb/pill.
- Dark mode is **system-preference** (`darkMode: 'media'` in `tailwind.config.js`); the dark palette lives in `assets/css/tufte.css` under `@media (prefers-color-scheme: dark)`. There is no manual theme toggle. Prefer the token utilities (`bg-paper`, `bg-paper-raised`, `text-ink`, `text-body`, `text-mute`, `text-accent-ink`, `border-rule`, `font-serif`, `max-w-measure`) over `dark:` variants and never reintroduce `blue-*`, `bg-gray-*`, rounded buttons, or shadows.
- Reader prose uses `@tailwindcss/typography`, restyled in `tailwind.config.js` to ET Book / 65ch / accent links / hairline rules. Article images carry a 1px pure-black/white 10% `outline` (in `main.css`) so a pale photo edge doesn't bleed into the paper — never a warm neutral there, a tinted line reads as dirt on the edge.
- Interactive mono-label buttons should carry a `focus-visible` outline. `ActionLabel` and `.mono-button` bring their own; anything hand-rolled needs `focus-visible:outline focus-visible:outline-1` or a scoped `:focus-visible { outline: 1px solid var(--tufte-accent); }`.
- **`.mono-button` (global, `assets/css/main.css`) is the unframed sibling of `ActionLabel`** — the quiet row verb (Remove, Dismiss, Sync, Tags, Sign out, the highlights chips). It carries the 10px/0.16em mono type, mute→ink hover, the focus ring, a disabled state, and the touch pad. Use it instead of re-deriving the type inline; `--danger` swaps the hover to crimson, `--tight` halves the pad for controls in a wrapping row. Pages keep their semantic hook class (`.hl-remove`, `.gr-remove`, `.disc-dismiss`, `.tag-chip`) alongside it — the component tests select on those names.
- **Touch targets.** 10px mono text is a ~12px-tall hit area. `ActionLabel`, `.mono-button`, and `.tap-pad` / `.tap-pad--y` (hit area only, for controls that already own their type — the deck's Deck/Grid toggle, the Shelf header glyph links) grow the pressable box with an absolutely-positioned `::after`, which costs no layout. Two rules when adding one: grow **vertically only** where neighbours sit closer than ~12px sideways (the reader's action row is 6px apart), and leave the caller enough margin that two pads never overlap — an overlap means taps land on the wrong control. Several `mt-*` values (Sources feed-row verbs, Shelf/Good-reads Remove) exist to buy exactly that clearance.
- **Reduced motion** is honoured globally in `main.css`: decorative CSS transitions, keyframes, and view transitions are stilled under `prefers-reduced-motion: reduce`. The deck's drag physics are deliberately unaffected — those are JS-driven MotionValues writing inline transforms, and a card must still follow the thumb.
- Headings get `text-wrap: balance` and prose paragraphs `text-wrap: pretty` (global, `main.css`) — at a 65ch measure in ET Book a stranded last word shows badly.
- **List rooms never scroll the document.** Every page that shows `BottomBar` and scrolls (`/sources`, `/shelf`, `/highlights`, `/good-reads`, `/discover`, `/search`) wraps its content in `<main class="fixed inset-0 overflow-y-auto overscroll-none">` with the centered `max-w-measure` block as an inner div — the same pattern as `DeckScreen`. With zero document scroll height, iOS Safari's rubber-band has nothing to bounce, so the fixed `BottomBar` can't detach and ride up the screen during a fast fling (the bug this fixed on Sources). The article page keeps document scroll on purpose (reading-position math uses `window.scrollY`; the bar is hidden there). Trade-off: inner scroll position resets on navigation (no window-scroll restoration).

## Tufte Viz design system and the card deck

The entire UX is a ground-up build in the **Tufte Viz design system** (warm paper, ET Book serif, hairline rules, one accent). Build plan: `docs/superpowers/plans/2026-06-09-tufte-reader-rebuild.md`. Canonical system: the `tufte-viz` skill at `~/github/skill-tufte-viz/`.

**Vendoring** (the design system can't be reached at runtime on the deployed Worker):
- `public/tufte/fonts/` — ET Book woff files (roman / italic / bold) + license
- `assets/css/tufte.css` — `@font-face`, the `--tufte-*` base tokens, semantic aliases (`--text-*`, `--surface-*`, `--border-*`), and the dark palette under `@media (prefers-color-scheme: dark)`. Loaded first in `nuxt.config.ts` `css` so `main.css` can override.
- `config/tufte.preset.cjs` — the Tailwind preset (added to `tailwind.config.js` `presets`) exposing the token utilities (`paper`, `ink`, `body`, `mute`, `accent`, `rule`, `measure`, …)
- `app.vue` sets `bg-paper text-ink font-serif` and mounts `BottomBar` + `AppToast` + `PwaUpdatePrompt`

**App icon** (`scripts/gen_icon.py`): the Do/Write/Sleep family mark — a thin serif "R" in ink above the rust rule on aged paper. Forked from `~/github/write/Write/scripts/gen_icon.py`. The family font is American Typewriter Light (macOS-only): on a Mac the script uses it directly; on Sleeper it falls back to the vendored Josefin Slab variable font (`scripts/fonts/`, OFL) at wght=330, matched to the Do icon's stroke weight (min stem ≈1.55% of canvas vs the D's 1.56%). Regenerating writes `public/{pwa-192x192,pwa-512x512,apple-touch-icon,favicon}.png` — full-bleed opaque squares (platforms mask their own corners); needs a venv with `pillow` + `fonttools` (instructions in the script header). The old blue-book `favicon.svg` / `apple-touch-icon.svg` and their `sharp`-based generator are gone.

**Four rooms**, switched by `BottomBar.vue`: the **Deck** (`/`, the card stack of unread articles), the **Found** room (`/found`, social bookmarks — a `DeckScreen` scoped to the Found feed; see "Found feed (social bookmarks)"), the **Shelf** (`/shelf`, saved articles), and **Sources** (`/sources`, feed management + account). The reader (`/article/:id`) and login sit outside the bar. Tag group headers on the Sources page link to `/TAG-NAME`; tag routes show the Deck room active in `BottomBar`.

**The five verbs** — one interaction model on touch and keys, all routed through `CardStack.commit(direction)`:

| Gesture / key | Verb | Implementation |
|---|---|---|
| swipe ← / `←` | **Mark read** | optimistic: fling, advance, `markAsRead(id, true).catch(toast)` |
| swipe → / `→` | **Save** (shelf) | optimistic: fling, advance, `saveArticle().catch(toast)` |
| swipe ↑ / `↑` | **Elevate** to SFL | **non-optimistic**: card holds mid-air awaiting SFL, springs back on failure; on success also marks read |
| swipe ↓ / `↓` | **Skip** | `advance` rotates the id to the back of the deck (no API call) |
| tap / `o` / `Enter` | **Open** the reader | navigate `/article/:id` (non-destructive, card stays) |

`u` / the `— UNDO` toast reverses the last destructive verb: unsave, mark-unread, or un-elevate (which deletes the SFL idea **only** when the elevate created it — `ideaExisting` entries are left alone — then marks unread).

**Physics** (`motion-v` inside `CardStack.vue`): the top card is a `motion.div` with `drag` + `drag-snap-to-origin`; its `x`/`y` are MotionValues and `rotate` is a transform of `x` (max ±9°). All visible cards render through one keyed branch so a promoted card keeps its component instance and springs into place. Tunables live in `utils/deck.ts` `DECK` (distance/velocity thresholds, dominance ratio, spring/fling configs). Commit resolution = distance OR a same-direction flick, dominant axis only (`resolveDirection`). The pending verb fades in as the one accent during the drag.


**Pure logic** (unit-tested, no DOM) lives in `utils/` — see
[`../utils/CLAUDE.md`](../utils/CLAUDE.md) for the full index.


**The deck-snapshot pattern** (`components/DeckScreen.vue`): the component passes CardStack a **snapshot** (`deckArticles = [...unreadArticles.value]`), deliberately not the live computed — `markAsRead` optimistically flips `isRead`, which would shrink a computed deck on every right-swipe, retrigger CardStack's refill watcher, and wipe the deck + undo history mid-session. The deck refills only on load, explicit sync, and returning from grid mode (all explicit boundaries); the header's unread count stays live via CardStack's `@count` emit. Anything needing the *current* top card must ask CardStack (e.g. `openTop()`), not the snapshot.

**Grid view** (the deck's scrollable alternate, `components/grid/` + `useViewMode()`): a survey mode — a 1-col list of row-layout `MiniCard`s on phones, a 3-col grid of stacked cards ≥sm — for looking over many articles at once, toggled from the deck header and persisted in localStorage. Deliberate contrasts with the deck:
- **Binds the live list** (`unreadArticles` filtered by `savedArticleIds`), not a snapshot — a consumed card *should* leave a survey view, and undo re-inserts it automatically at its published-order position. The grid keeps its own LIFO undo history (no deck order to restore).
- **Verbs**: horizontal swipe ← read / → save (optimistic, same semantics as the deck; `resolveGridDirection` with the deck's 110px distance/600 velocity thresholds plus a **stricter dominance gate** — horizontal must beat vertical 2:1 (deck is 1.4), since a grid cell shares the surface with the scroller; the pending accent label obeys the same rule), tap opens the reader. **No elevate** (vertical gestures belong to scrolling — elevate stays deck-only) and **no skip** (scrolling past *is* skipping). The gesture split is `drag="x"` + `touch-action: pan-y` per cell, with one shared `x` MotionValue bound to the active cell only.
- **Paged loading**: first page stays `limit: 100` (shared with deck mode — toggling must not hand the deck a thin stack); past that, an IntersectionObserver sentinel loads pages of `GRID.PAGE_SIZE` (24) via `useArticles().loadMoreArticles()`. Because the list is fetched `isRead=false&excludeSaved=true`, marking cards read shifts the server window — the next offset is the **count of fetched rows still matching** (`nextPageOffset`), appended pages are deduped by id, and an all-duplicate page bumps `extraOffset` so the loop terminates. The saved-articles path (`fetchArticles(-1)`) resets `lastQuery`/`hasMore` so the shelf is never paginated.
- **No prefetch** (deliberate): the deck warms exactly one card; a grid shows 6–12 and scrolls, so visibility-driven full-text prefetch would burn external fetches + R2 writes (~3 subrequests each against the Worker's 1000 cap) on cards never opened. Imageless cards degrade to the typographic variant; the reader still fetches on open.
- **Header count** in grid mode: `max(gridArticles.length, total − consumed)` — honest about unfetched pages, live as cards leave.

**Race guards** in `CardStack`: `commit` no-ops while `busy` (an in-flight commit) or `dragging`; `performUndo` no-ops while `busy`; `applyAdvance` verifies the expected top id before mutating. `settleWithin()` races every awaited animation against a 1.2s timeout because motion-dom's `JSAnimation.finished` never resolves when an animation is stopped (e.g. a pointer re-grab) — without it `busy` could wedge forever.
