# Shared pure logic (`utils/`)

Everything here is **pure and unit-tested** — no DOM, no fetch, no Nuxt runtime — so
Jest can exercise it directly and the components stay thin. When a component grows a
decision rule (a gesture threshold, a pagination offset, a chunking boundary), it
belongs here with a test beside it.

Auto-imported by Nuxt. Server-side helpers live in
[`../server/CLAUDE.md`](../server/CLAUDE.md).

The three swipe-gesture rule sets here (`deck.ts`, `grid.ts`, `readerSwipe.ts`)
are the reference implementations of the Tufte Viz design system's **Swipe
Card** element — its spec (`references/swipe-card.md` in
`~/github/skill-tufte-viz/`, alongside `references/card-deck.md` for the Deck)
cites their exact constants as the canonical tuning table. If you retune any of
them or change the commit grammar, mirror the change into those specs
(codified 2026-08-01).

## The modules

- `utils/deck.ts` — `resolveDirection(dx, dy, vx, vy)`, `advance(deck, action)`, `undo(deck, history)`, `DECK` constants, `DeckHistoryEntry` (carries `ideaId`/`ideaExisting` for elevate)
- `utils/decay.ts` — half-life aging for the deck (2026-08-10): `decayAge(publishedAt, halfLifeHours, now)` (age in half-lives; missing/invalid dates read as 0 — never fade), `hasFaded` (past `FADE_HORIZON` = 3 half-lives; the ∞ pace never), `halfLifeLabel` / `nextHalfLife` (the Sources "Pace" cycle: 12h → 1d → 3d → 7d → 30d → ∞), `softCount(n)` (the deck header's flexible count — precise to `COUNT_CAP` = 40, then "40+"), `DECAY` constants (default half-life 720h = 30d; `FOREVER_HOURS = -1` is the ∞ sentinel — never fades, but *orders* by the default half-life so evergreen cards drift down instead of pinning to the top). **The SQL in `server/api/articles/index.get.ts` mirrors `decayAge`/`hasFaded` — change them in lockstep.**
- `utils/grid.ts` — `resolveGridDirection(dx, dy, vx)` (horizontal commit resolution gated on horizontal-over-vertical dominance — a diagonal release is a scroll, never a commit), `nextPageOffset(articles, savedIds, extraOffset)` (pagination under a shrinking unread window), `dedupeAppend(existing, page)`, `nextUnreadId(articles, savedIds, currentId)` (the reader's mark-read-and-continue: next unread+unsaved article after the current one, wrapping; null outside a deck context), `GRID` constants (page size 24, 110px distance threshold, 2.0 dominance ratio, sentinel margin)
- `utils/cardData.ts` — `stripHtml`, `readingTimeMinutes` (220 wpm, null for thin excerpt bodies), `cardImageUrl` (filters legacy Unsplash filler; rejects video renditions — `.mp4`/`.m3u8`/`.webm`/`.mov` — which can never render in an `<img>` and would otherwise show a broken card, the shape X video posts had before the video fix; repairs entity-encoded `&#038;`/`&amp;` ampersands from legacy rows; appends `w=1200` to WordPress-upload URLs without a width param — WP CDNs otherwise serve the un-resized master asset, up to 11k×7.5k px from The Verge, whose decoded size crashed iOS Safari with "a problem repeatedly occurred"), `excerpt`
- `utils/readerSwipe.ts` — the reader's swipe-away gesture rule: `resolveReaderSwipe(dx, dy, vx, startX, viewportWidth)` (left-only commit on distance or same-sign flick, deliberately pickier than deck/grid — 150px distance, 800px/s flick, 3:1 dominance so anything near a scroll never commits, and a 32px `EDGE_GUARD` rejecting gestures that start where the browser's back/forward navigation swipes live), `readerSwipeProgress(dx, dy)` (accent-label opacity, mirrors the commit gates), `READER_SWIPE` constants
- `utils/rsvp.ts` — RSVP speed-reading math: `tokenizeWords`, `orpIndex` (Spritz-style optimal-recognition-point, leading/trailing punctuation aware), `wordDelayMs` (base beat from wpm; sentence ×2.2, clause ×1.5, long-word ×1.3 dwell), `RSVP` constants (wpm 100–800 step 25, default 300)
- `utils/tts.ts` — read-aloud chunking: `chunkTextForTts` (sentence-boundary chunks ≤ `TTS.MAX_CHUNK_CHARS` = 1100; over-long sentences hard-split on word boundaries, mid-word only for unbreakable tokens like URLs), `locateChunks` (maps each chunk back to `{start,end}` offsets in the raw source text through the whitespace normalization — powers the read-aloud follow view), `TTS` constants

- `utils/processArticleContent.ts` — sanitize + paragraphize + clean (see "HTML sanitization" below)
- `utils/cleanArticleContent.ts` — `cleanArticleDom`, the display-time junk pass
- `utils/paragraphize.ts` — `looksLikePlainText` / `paragraphize` for legacy plain-text bodies
- `utils/truncation.ts` — `looksTruncated`, the feed "read-more" footer detector
- `utils/highlightDom.ts` — selection ↔ offsets, `paintHighlight`, `rangeForOffsets`
- `utils/hashtags.ts` — `extractHashtags`, `renderNoteHtml`
- `utils/searchRender.ts` — sentinel → `<mark>` snippet rendering
- `utils/feedHealth.ts` — `feedHealthNote` for the Sources rows
- `utils/readingPosition.ts` — `shouldRestorePosition`, `restoreScrollTop`, `progressWorthSaving`
- `utils/share.ts` — X / Threads web-intent URL builders
- `utils/formatDate.ts` — `formatRelativeDate`
- `utils/settleWithin.ts` — `settleWithin`, the animation-await safety net (shared by
  `CardStack` and the reader's swipe-away; motion-dom's `JSAnimation.finished`
  never settles when an animation is *stopped*, so a bare await can wedge a
  `busy` guard forever)

## HTML sanitization

**HTML Sanitization**: Use `processArticleContent()` from `utils/processArticleContent.ts` (DOMPurify allowlist + forcing `target="_blank" rel="noopener noreferrer"` on links) before rendering article HTML — done client-side in `pages/article/[id].vue`. It first runs `looksLikePlainText` / `paragraphize` from `utils/paragraphize.ts` so legacy plain-text R2 blobs render paragraphed. Display-time DOMPurify is the security boundary — there is deliberately no server-side sanitization.

**Video in the allowlist**: `video` + `source` are allowed (with `controls`, `poster`, `playsinline`, `preload`, `muted`, `type`) so X video posts play inline in the Found feed — see the renderers in `server/utils/xRender.ts` and `scripts/sleeper-articles-sync.mjs`. **`iframe` is deliberately NOT allowed**, and neither is `autoplay`: this allowlist is the *only* sanitization layer and Reader ingests arbitrary RSS, so an iframe allowance would let any feed embed third-party frames. If YouTube/Vimeo embeds are ever wanted, do it as a separate change with a `src` host allowlist and `sandbox` — not by widening this list. Note `cleanArticleDom`'s empty-block sweep counts `video` as media (`hasMedia`), otherwise an X video card — a `<p>` whose only child is the player, with no text — gets swept away as an empty block.

## Extraction-junk cleanup

**Extraction-junk cleanup**: after sanitizing, `processArticleContent` runs `cleanArticleDom` from `utils/cleanArticleContent.ts` (pure, jsdom-tested) — a deterministic display-time pass over the sanitized DOM, so the stored R2 body is never mutated, every rule is reversible, and the whole backlog benefits at once (display, RSVP, and read-aloud all derive from `sanitizedContent`). Rules, distilled from real fetched bodies: exact-match removal of share/chrome blocks ("Follow", "Link copied to clipboard", "REG AD", "Reply"…), recirculation-rail headings ("Editor's picks", "Trending Stories"…), a duplicated title block near the top (title passed via `opts.title`; `hasMedia` counts `<img>` **and `<video>`**, so a media-only block survives the sweep), leading scraps (stray chars / bare karma numbers), a comment-tail cut (first "N Comments" / "Moderation Log" / LessWrong `[-]…` block past the article midpoint takes everything after it), and an iterative empty-block sweep. Meta text is kept but demoted with the `article-meta` class (italic + muted, `assets/css/main.css`): bylines, datelines, read-time chips, image credits, affiliate disclosures — all guarded against prose false-positives (sentence-ending punctuation, length, word count). Junk removal only fires on exact normalized matches; prose is never touched. Existing highlights survive block removal via the quote-string fallback locator.

## Date formatting

**Date Formatting**: Use `formatRelativeDate()` from `utils/formatDate.ts` for relative time display (e.g., "5 minutes ago"). Do not create local formatDate functions in components.
