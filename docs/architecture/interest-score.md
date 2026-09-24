# Interest score (TypeSafe Jev)

**`Article.interest`** (REAL 0..2, NULL = unscored; migration `021`, 2026-09-17): a
gentle deck-ranking boost from [TypeSafe Jev](https://api.typesafe.ai) (`POST
/v1/systemone`, `model: 'jev-latest'`), a hosted decision model (~0.5s/call,
essentially free). `server/utils/interest.ts` builds the exact request — a fixed
reader-profile string + the article's feed title/title/summary (HTML stripped,
clamped 600 chars) — and `scoreInterest()` calls it with a 15s timeout, **failing
soft to `null`** on any error (unset `NUXT_TYPESAFE_API_KEY`, network error, timeout,
non-OK response, or a malformed body). `POST /api/internal/score-interest` fills the
column for unscored, unread articles from the last 7 days; found/manual articles are
scored too (harmless — the column only feeds the ranking boost, feed `kind` still
governs fading).

Evaluated 2026-09-17 on 400 of 480 labeled Reader articles: the `interest` question
separated saved/good-read/highlighted articles from untouched ones with **AUC 0.80
overall, 0.70 within the same feed**; combined with the feed half-life signal it
improved ranking. So it's wired in as a boost, never a filter: the deck/grid decay
mode (`server/api/articles/index.get.ts` `DECAY_AGE`) multiplies the half-life by
`INTEREST_BOOST = 0.75 + 0.25 * COALESCE(a.interest, 1)` (0.75..1.25, unscored
articles get the neutral 1.0) before dividing by it — a high-interest article's
effective age grows slower, so it ranks higher for longer, while an ordinary one
still eventually fades on the *unboosted* age/half-life (the fade `WHERE` clause is
untouched — interest reorders, it never hides or keeps an article). Mirrored as the
pure `interestBoost()` in `utils/decay.ts` (not used by `hasFaded`, deliberately).
