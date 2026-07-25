# Composables

Two kinds live here, and the difference matters.

## Global state (`useState`)

Shared across every component that calls them — the app's state layer. These are
documented in [`../docs/architecture/state-model.md`](../docs/architecture/state-model.md):
`useArticles`, `useFeeds`, `useSavedArticles`, `useGoodReads`, `useHighlights`,
`useTags`, `useElevate`, `useToast`, `useAuth`, `useViewMode`, `useTextSize`,
`useHaptics`.

Rule: when using `useState` with a `Set`, always **replace** the Set rather than
mutating it — Vue's reactivity doesn't track Set mutations.

## Per-instance surfaces (plain refs)

Created and torn down with one component, holding no global state. These exist so a
page that owns several independent surfaces stays readable — the page keeps the
wiring (which surface may act, and what happens after), each composable keeps its own
mechanics. All four are used by `pages/article/[id].vue`:

- **`useArticleHighlights(articleId, articleEl)`** — the yellow pen: selection →
  offsets → note overlay → painted `<mark>`, plus the popover and removal. Saving is
  deliberately non-optimistic (the mark is painted only once the server returns an id).
- **`useReadAloud({ articleEl, article })`** — the reading voice: sentence-boundary
  chunking, one reused `<audio>` element (iOS gesture unlock), the `ttsToken`
  invalidation counter, the CSS Custom Highlight follow-wash, and Media Session
  wiring. **The caller must call `stopReadAloud()` on unmount.**
- **`useReadingProgress(articleId, article)`** — keeping your place: debounced
  server-side save of the scroll fraction, flush on hide/unmount, restore on re-entry.
  The caller owns the listeners.
- **`useReaderSwipe({ enabled, onCommit })`** — the swipe-away gesture: coarse-pointer
  only, edge-guarded, committed by the picky `utils/readerSwipe.ts` rule. `enabled` is
  the page's gate for everything else that can own the gesture space; `fling()` runs
  the animation and resolves once it settles.

These are **not** auto-shared: calling one twice gives two independent instances.
Reach for this shape when logic belongs to a mounted surface, not to the app.
