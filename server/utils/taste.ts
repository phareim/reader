/**
 * Minimal taste-maker ingest client for the highlight mirror.
 *
 * One-way funnel: Reader is where taste is encountered, taste-maker
 * (taste.phareim.no) is where it is refined. Every personal-account highlight
 * is mirrored as a `quote` item; taste-maker dedupes on
 * `reader-highlight:<id>` so re-sends are idempotent.
 *
 * Everything here is BEST-EFFORT by design (unlike sfl.ts, whose non-503
 * errors surface to the user): the mirror is downstream of the highlight, a
 * NULL taste_item_id is repairable via scripts/taste-highlight-sync.mjs, and
 * a taste-maker outage must never sink a highlight.
 */

import type { H3Event } from 'h3'

interface TasteConfig {
  url: string
  key: string
}

export function getTasteConfig(event: H3Event): TasteConfig | null {
  // Event-scoped for the same reason as getSflConfig: on Workers the env
  // bindings only exist per-request. Returns null (not a throw) when
  // unconfigured — the mirror is optional.
  const config = useRuntimeConfig(event)
  if (!config.tasteApiUrl || !config.tasteIngestKey) return null
  return { url: config.tasteApiUrl, key: config.tasteIngestKey }
}

/**
 * Mirror a highlight as a taste-maker quote item. Returns the taste item id,
 * or null on any failure (never throws).
 */
export async function createQuoteItem(
  cfg: TasteConfig,
  highlight: { highlightId: number; quote: string; note?: string; sourceUrl: string; sourceTitle: string },
): Promise<string | null> {
  try {
    const res = await fetch(`${cfg.url}/api/ingest/highlight`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cfg.key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        highlight_id: highlight.highlightId,
        quote: highlight.quote,
        note: highlight.note || undefined,
        source_url: highlight.sourceUrl,
        source_title: highlight.sourceTitle,
      }),
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) return null
    const body = await res.json() as { item?: { id?: string } }
    return typeof body?.item?.id === 'string' && body.item.id !== '' ? body.item.id : null
  } catch {
    return null
  }
}

/**
 * Undo the mirror for a deleted highlight. taste-maker only deletes the item
 * while it is untouched (no refine wins/losses, no connections) — once the
 * taste library has worked with it, the library owns it. Best-effort.
 */
export async function deleteQuoteItem(cfg: TasteConfig, highlightId: number): Promise<void> {
  try {
    await fetch(`${cfg.url}/api/ingest/highlight/${highlightId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${cfg.key}` },
      signal: AbortSignal.timeout(10_000),
    })
  } catch {
    // best-effort: a failed taste undo must not fail the highlight delete
  }
}
