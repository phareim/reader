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

## Current suites

- `__tests__/utils/deck.test.ts` — pure deck state machine (`resolveDirection`, `advance`, `undo`)
- `__tests__/utils/grid.test.ts` — grid-view pure logic (`resolveGridDirection` distance/flick/wrong-sign-flick/diagonal-dominance, `nextPageOffset` read/saved/extraOffset accounting, `dedupeAppend` reference-preserving merge, `nextUnreadId` forward-scan/wraparound/read+saved skipping/no-context null)
- `__tests__/utils/cardData.test.ts` — card derivations (`stripHtml`, `readingTimeMinutes`, `cardImageUrl`, `excerpt`)
- `__tests__/server/feedImage.test.ts` — lead-image extraction from raw feed entries (fast-xml-parser `@_` attribute shape, arrays, media:group, enclosures, content fallback)
- `__tests__/server/xRender.test.ts` — X bookmark → Found-item rendering (`server/utils/xRender.ts`): author line/escaping/note_tweet, quoted + replied-to context blocks, media + lead image, video rendering (`<video>` off the highest-bitrate mp4 variant, HLS ignored, still-only fallback, poster-not-mp4 lead image), link filtering/dedupe, native X Article rendering incl. the heading heuristic
- `__tests__/server/redditRender.test.ts` — Reddit saved item → Found-item rendering (`server/utils/redditRender.ts`): t3 self/link/image posts (selftext_html, preview image, external-link line), t1 comments with thread context, escaping, unrenderable-child nulls
- `__tests__/server/hn.test.ts` — Hacker News favorites (`server/utils/hn.ts`): id scrape off the favorites page (both quote styles), More-link detection, Firebase item → Found-item rendering (link story vs Ask HN, comment/deleted/dead skips)
- `__tests__/server/githubStars.test.ts` — GitHub starred repos → Found-item rendering (`server/utils/githubStars.ts`): star+json vs plain-repo shapes, starred_at → publishedAt, escaping, star-count compaction, homepage-link filtering, unrenderable-entry nulls
- `__tests__/components/CardStack.test.ts` — commit/undo wiring, race guards, elevate failure paths
- `__tests__/components/DeckScreen.test.ts` — DeckScreen tag prop, 404→notFound emit, snapshot pattern, deck/grid toggle, grid keyboard branching, re-snapshot on grid→deck return, feed-scoped shift+R (refreshFeed for pull feeds, full sync for the push-only Found feed)
- `__tests__/components/MiniCard.test.ts` — grid mini card: image vs typographic variant, Unsplash-filler filtering, footer (feed · age), no excerpt
- `__tests__/components/ArticleGrid.test.ts` — grid commit wiring (save/read + undo toast), busy guard, LIFO undo, tap→reader, IntersectionObserver sentinel → `loadMore`, empty state
- `__tests__/components/TagEditorOverlay.test.ts` — chips, suggestion filtering, keyboard (Enter/comma/arrows/Backspace/Esc), save/close emits
- `__tests__/components/HighlightNoteOverlay.test.ts` — quote display, save emits trimmed note, Cmd/Ctrl+Enter commit, saving-guard
- `__tests__/components/RsvpOverlay.test.ts` — ORP split rendering, play/pause + done→restart (fake timers), wpm keys with clamping + localStorage persistence, word skips, Esc/Close emits
- `__tests__/utils/rsvp.test.ts` — `tokenizeWords`, `orpIndex` (length convention, punctuation skipping), `wordDelayMs` (sentence/clause/long-word dwell)
- `__tests__/utils/tts.test.ts` — `chunkTextForTts` (sentence-boundary packing, whitespace normalization, over-long sentence/word hard-splits, no-word-loss round-trip), `locateChunks` (chunk → raw-text offset spans through whitespace normalization, moving-cursor repeats, contiguous coverage)
- `__tests__/utils/hashtags.test.ts` — `extractHashtags` (dedupe, unicode, punctuation/url boundaries), `renderNoteHtml` (escape + accent-span wrap)
- `__tests__/utils/highlightDom.test.ts` — `paintHighlight` (exact + indexOf fallback, cross-element spans), `unpaint`/`clearHighlights` round-trips, `rangeForOffsets` (offset span → DOM Range across element boundaries, no DOM mutation)
- `__tests__/utils/truncation.test.ts` — `looksTruncated` (Ars "Read full article" footer, "Continue reading", `[…]` brackets, canonical-URL anchor; negatives for full bodies + inline read-more links)
- `__tests__/utils/share.test.ts` — `xShareUrl` / `threadsShareUrl` / `xQuoteShareUrl` / `threadsQuoteShareUrl` (param shape, encoding, empty/null title, Threads link-only text, curly-quoted passage + link for quote shares)
- `__tests__/utils/readingPosition.test.ts` — `shouldRestorePosition` (3%–95% band), `restoreScrollTop` (fraction → clamped scrollTop), `progressWorthSaving` (1% write threshold)
- `__tests__/utils/readerSwipe.test.ts` — the reader's swipe-away resolver (`resolveReaderSwipe`: distance/flick commits, wrong-sign-flick rejection, 3:1 dominance gate, left/right edge-navigation guard; `readerSwipeProgress` label gating + ramp)
- `__tests__/components/BottomBar.test.ts` — the four rooms render in order, Found active only on the found route, hidden on reader/login
- `__tests__/components/FeedPickerOverlay.test.ts` — smart-add feed picker: row rendering + source host, add emit, Added/busy states, Cancel↔Done footer, Esc close
- `__tests__/components/SaveArticleOverlay.test.ts` — smart-add article prompt: metadata rendering (optional author/description), save/close emits, saving-guard, Esc close
- `__tests__/components/ShelfPage.test.ts` — the `/shelf` room: listing, swipe-left archive (mark read + unsave, already-read rows skip the redundant mark-read), undo (re-save + positional re-insert, mark-unread only when it was unread), Remove button stays read-state-neutral
- `__tests__/components/FoundPage.test.ts` — Found-feed resolution (empty state + refetch vs. deck scoped to the `kind='found'` feed)
- `__tests__/components/GoodReadsPage.test.ts` — the `/good-reads` room: listing with feed/title/article link, remove (optimistic splice + failure keeps row), empty state
- `__tests__/components/HighlightsPage.test.ts` — the `/highlights` commonplace book: listing with quote/note/article link + SFL badge, hashtag-chip derivation + filter toggle, `renderNoteHtml` note rendering, remove (optimistic splice + failure keeps row), empty state
- `__tests__/components/DiscoverPage.test.ts` — the `/discover` blogroll-graph page: ranked rows with via-line, quiet note only on stale candidates, Add → subscribe POST + toast + `— ADDED` flip (failure keeps row actionable), Dismiss → optimistic removal (failure restores), empty state + "Look now" refresh→refetch
- `__tests__/server/blogroll.test.ts` — Discover's pure blogroll parsers (`server/utils/blogroll.ts`): `parseOpmlOutlines` (nested-category flattening, attr order/quote styles, entity decode, `&nbsp;` tolerance), `isOpml` body sniff, `extractBlogrollLink` rel-token handling, `extractExternalLinks` (origin/platform filtering, footer/nav chrome exclusion, article-link dropping, host dedupe, cap), `candidateHost`/`isPlatformHost`
- `__tests__/server/urlNormalize.test.ts` — `normalizeUrl` for cross-source Found dedup (scheme/www/fragment folding, tracking-param strip, twitter→x.com aliasing, X path-only params, YouTube params preserved, never-collide negatives)
- `__tests__/utils/feedHealth.test.ts` — `feedHealthNote` Sources annotations (failing/paused/quiet states, silence for healthy + push-only kinds, failing-beats-quiet precedence)
- `__tests__/server/searchIndex.test.ts` — `buildFtsQuery` (token quoting, prefix-last, FTS-syntax neutralization, 8-token cap) + `renderSnippetHtml` (sentinel→`<mark>`, escape-before-mark injection safety, client/server sentinel parity)
- `__tests__/server/feedRigs.test.ts` — per-feed rigs (`server/utils/feedRigs/`): `rigForUrl` host matching, the SMBC entry cleanup + page extractor (comic/hovertext/bonus panel), the Oglaf extractor (single + multi-page stories, same-story next guard, caption filtering), the Daring Fireball `fullTextComplete` link-blog guard, the xkcd caption rig (entry + `#comic` extract), the Oatmeal panel-sequence extractor (thumbnail filtering), and the Pluralistic boilerplate trim
- `__tests__/server/emailIngest.test.ts` — email→Reader helpers: `stripForwardPrefixes` (chained Fwd/Re/SV/VS), `firstHttpLink` (href-first, bare-URL boundaries + punctuation shed), `emailGuid` (stability, over-long compression), and the email Worker's `senderAuthOk` alignment check (DKIM/SPF/DMARC pass + relaxed alignment, unrelated-domain and suffix-trickery rejections, allow-on-missing-header)
- `__tests__/components/BasicComponent.test.ts` — smoke test for the Vue/Jest toolchain
