# Anthropic bridge feeds

Anthropic publishes **no RSS** for anthropic.com/news or /engineering, and the
alignment blog serves its SPA shell on every feed-looking path (a 200 + HTML —
exactly the catch-all trap `blogroll.ts` guards against); red.anthropic.com is
301'd into the main site. Only transformer-circuits.pub has a real feed
(`/feed.xml`, subscribe directly). So the reader bridges the rest itself:
`GET /api/bridge/anthropic/[section]` (`news` | `engineering` | `alignment`,
**public** — feed sync fetches without cookies) fetches the listing page and
serves minimal RSS 2.0; the reader subscribes to its own bridge URLs like any
feed. Parsing is pure in `server/utils/anthropicBridge.ts`: news/engineering
mine the Next.js flight payload (`self.__next_f` chunks, decoded by
`decodeFlightPayload` and scanned for balanced `{"_type":"post"}` /
`{"_type":"engineeringArticle"}` objects — title/publishedOn/summary/cardPhoto
live there, NOT in the DOM, and the payload is compact JSON so marker matching
is exact) with the rendered DOM anchors as the section filter; alignment walks
the static homepage (`a.note` entries, month-granularity `div.date` dividers
that **precede** their group). Items are capped at 20 (`BRIDGE_ITEM_CAP`) so a
fresh subscribe doesn't flood the deck; bodies are deliberately link-only —
full-text fetch + the [`anthropic` rig](feed-rigs.md) render the article. An
upstream failure **or an empty parse on a 200 page** (markup drift) returns 5xx
so feed sync records the error and Sources shows the health note instead of
silently syncing nothing. Fixtures for all three parsers are trimmed real
captures in `__tests__/fixtures/anthropic-*.html`.
