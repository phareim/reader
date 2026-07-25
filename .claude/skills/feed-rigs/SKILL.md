---
name: feed-rigs
description: Add or fix a per-feed rig in Reader — bespoke handling for one feed's quirks (comics whose RSS drops the image, link-blogs whose article URL points elsewhere, feeds with boilerplate tails). Use when a specific feed renders badly, loses its image, gets its commentary overwritten by full-text fetch, or carries junk the generic pipeline can't clean.
---

# Adding a per-feed rig

A `FeedRig` is the seam for "do a little extra work for this one feed". Rigs live in
`server/utils/feedRigs/`, own one or more hosts, and **fail soft into the generic
pipeline** — a throw or a null return falls back, so a rig bug can never break sync or
full-text fetch.

## First: decide which hook you need

| Symptom | Hook | Why |
|---|---|---|
| The RSS body is fine but carries junk (banners, "click here", boilerplate tails) | `entry` | Pure, runs at parse time on every entry |
| The RSS body loses the image (comic feeds without `content:encoded`) | `entry` | Rebuild the body from the raw markup |
| The feed body **is** the article, and full-text fetch would overwrite it | `entry` + `fullTextComplete: true` | Link-blogs: the article URL points at the *linked* page |
| The real content is only on the page, and Readability can't find it | `extract` | Runs before Readability with the fetched HTML |
| The story spans several pages | `extract` + the `fetchPage` helper | Same-host only, 12-fetch budget |

If none of these fit, the problem is probably generic — fix
`server/utils/extractContent.ts` or `utils/cleanArticleContent.ts` instead, so every
feed benefits.

## The procedure

1. **Reproduce it first.** Find a real article id from the feed and look at what is
   actually stored, so you rig the real defect and not an imagined one:
   ```bash
   npx jest __tests__/server/feedRigs.test.ts    # the existing rigs, as reference
   ```
   Save a copy of the offending feed XML and/or page HTML — it becomes the fixture.

2. **Write the rig file** — `server/utils/feedRigs/<host>.ts`, exporting a `FeedRig`.
   Read two existing rigs before writing: `smbc.ts` (both hooks, comic rebuild) and
   `daringfireball.ts` (entry-only, `fullTextComplete`). Use the shared regex helpers
   from `rigHtml.ts` (`tagWithId`, `attrOf`, `sectionAfterId`, `nextLinkHref`,
   `absoluteUrl`, `escapeHtml`) rather than new ad-hoc regexes.

3. **Register it** — one line in the `RIGS` registry in `server/utils/feedRigs/index.ts`.
   Hosts are matched www-insensitively by `rigForUrl`.

4. **Test it** — add cases to `__tests__/server/feedRigs.test.ts` covering the happy
   path *and* the fail-soft path (malformed input returns null rather than throwing).
   Rigs are pure, so no network mocking is needed.

5. **Backfill existing rows.** Articles whose `full_text_status` already settled as
   `skipped`/`failed` before the rig shipped will **not** auto-upgrade — the reader's
   thin-body trigger skips settled rows. Re-run them explicitly:
   ```
   POST /api/articles/:id/fetch-fulltext
   ```

## Rules that are easy to get wrong

- **`entry` must be pure** — no fetch, no D1. It runs on every entry of every sync.
- **`extract` receives the page HTML already fetched**; don't fetch the article URL
  again. `fetchPage` is for *additional* same-host pages only.
- **Never let a rig throw into the caller.** Return null and let the generic pipeline
  take over; that is the whole safety model.
- **`fullTextComplete: true` is for link-blogs**, where the item's URL points at
  someone else's page. It inserts the row with `full_text_status='skipped'`.
- **Recirculation thumbnails are not content** — filter them by path (The Oatmeal's
  `/thumbnails/` vs `comics/<slug>/`) rather than by size.

## Current rigs

`smbc`, `oglaf`, `daringfireball`, `xkcd`, `oatmeal`, `pluralistic` — full behaviour
notes in [`server/CLAUDE.md`](../../../server/CLAUDE.md) under "Per-feed rigs".
