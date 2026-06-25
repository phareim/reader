/**
 * Minimal SFL API client for the elevate flow.
 *
 * SFL dedupes page ideas by URL: POST with an existing URL returns
 * `{existing: true, idea}` instead of creating — callers must treat
 * `existing` ideas as not-ours-to-delete on undo.
 */

import type { H3Event } from 'h3'

interface SflConfig {
  url: string
  key: string
}

export function getSflConfig(event: H3Event): SflConfig {
  // The event is required: on Cloudflare Workers the env bindings only exist
  // per-request, so the event-less useRuntimeConfig() (frozen at module load)
  // never sees NUXT_SFL_API_URL / NUXT_SFL_API_KEY and always 503s in prod.
  const config = useRuntimeConfig(event)
  if (!config.sflApiUrl || !config.sflApiKey) {
    throw createError({ statusCode: 503, statusMessage: 'SFL is not configured' })
  }
  return { url: config.sflApiUrl, key: config.sflApiKey }
}

export async function createPageIdea(
  cfg: SflConfig,
  page: { url: string; title: string },
): Promise<{ ideaId: string; existing: boolean }> {
  let res: Response
  try {
    res = await fetch(`${cfg.url}/api/ideas`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cfg.key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ type: 'page', title: page.title, url: page.url }),
      signal: AbortSignal.timeout(10_000),
    })
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'name' in err &&
        (err.name === 'TimeoutError' || err.name === 'AbortError')) {
      throw createError({ statusCode: 504, statusMessage: 'SFL timed out' })
    }
    if (err && typeof err === 'object' && 'statusCode' in err) throw err
    throw createError({ statusCode: 502, statusMessage: 'SFL network error' })
  }
  if (!res.ok) {
    throw createError({ statusCode: 502, statusMessage: `SFL create failed (${res.status})` })
  }
  let body: { idea: { id: string }; existing?: boolean }
  try {
    body = await res.json() as { idea: { id: string }; existing?: boolean }
  } catch {
    throw createError({ statusCode: 502, statusMessage: 'SFL returned malformed JSON' })
  }
  if (typeof body?.idea?.id !== 'string' || body.idea.id === '') {
    throw createError({ statusCode: 502, statusMessage: 'SFL response missing idea id' })
  }
  return { ideaId: body.idea.id, existing: Boolean(body.existing) }
}

/**
 * Create a self-contained `quote` idea for a highlighted passage. Unlike page
 * ideas we deliberately set NO `url`: quote dedup is url-scoped, and we want
 * many quotes per article. The source URL/title ride along in `data` so SFL
 * can backlink. Returns the new idea id.
 */
export async function createQuoteIdea(
  cfg: SflConfig,
  quote: { text: string; note?: string; sourceUrl: string; sourceTitle: string },
): Promise<{ ideaId: string }> {
  const title = quote.text.length > 120 ? `${quote.text.slice(0, 119)}…` : quote.text
  const payload = {
    type: 'quote',
    title,
    summary: quote.note || undefined,
    data: {
      text: quote.text,
      note: quote.note || undefined,
      source_url: quote.sourceUrl,
      source_title: quote.sourceTitle,
    },
  }
  let res: Response
  try {
    res = await fetch(`${cfg.url}/api/ideas`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cfg.key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10_000),
    })
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'name' in err &&
        (err.name === 'TimeoutError' || err.name === 'AbortError')) {
      throw createError({ statusCode: 504, statusMessage: 'SFL timed out' })
    }
    if (err && typeof err === 'object' && 'statusCode' in err) throw err
    throw createError({ statusCode: 502, statusMessage: 'SFL network error' })
  }
  if (!res.ok) {
    throw createError({ statusCode: 502, statusMessage: `SFL create failed (${res.status})` })
  }
  let body: { idea: { id: string } }
  try {
    body = await res.json() as { idea: { id: string } }
  } catch {
    throw createError({ statusCode: 502, statusMessage: 'SFL returned malformed JSON' })
  }
  if (typeof body?.idea?.id !== 'string' || body.idea.id === '') {
    throw createError({ statusCode: 502, statusMessage: 'SFL response missing idea id' })
  }
  return { ideaId: body.idea.id }
}

/**
 * Find-or-create a `type='tag'` idea by name and return its id — mirrors the
 * canonical sfl-hook convention (list /api/tags, case-insensitive title match,
 * else POST a new tag idea). Returns null on any failure so tagging stays
 * best-effort and never sinks the highlight.
 */
export async function findOrCreateTag(cfg: SflConfig, name: string): Promise<string | null> {
  const wanted = name.replace(/^#/, '').trim()
  if (!wanted) return null
  try {
    const listRes = await fetch(`${cfg.url}/api/tags`, {
      headers: { Authorization: `Bearer ${cfg.key}` },
      signal: AbortSignal.timeout(10_000),
    })
    if (listRes.ok) {
      const tags = await listRes.json() as { tags?: Array<{ id: string; title?: string }> }
      const hit = (tags.tags || []).find(
        (t) => (t.title ?? '').toLowerCase() === wanted.toLowerCase(),
      )
      if (hit?.id) return hit.id
    }

    const createRes = await fetch(`${cfg.url}/api/ideas`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cfg.key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ type: 'tag', title: wanted }),
      signal: AbortSignal.timeout(10_000),
    })
    if (!createRes.ok) return null
    const created = await createRes.json() as { idea?: { id?: string } }
    return created?.idea?.id ?? null
  } catch {
    return null
  }
}

/**
 * Connect `ideaId` → `tagId` with the canonical `tagged_with` label. Tolerates
 * the 400 "already exists" the API throws for duplicate connections. Best-effort.
 */
export async function tagIdea(cfg: SflConfig, ideaId: string, tagId: string): Promise<void> {
  try {
    await fetch(`${cfg.url}/api/connections`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cfg.key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from_id: ideaId, to_id: tagId, label: 'tagged_with' }),
      signal: AbortSignal.timeout(10_000),
    })
  } catch {
    // best-effort: a failed tag connection must not fail the highlight
  }
}

export async function deleteIdea(cfg: SflConfig, ideaId: string): Promise<void> {
  let res: Response
  try {
    res = await fetch(`${cfg.url}/api/ideas/${encodeURIComponent(ideaId)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${cfg.key}` },
      signal: AbortSignal.timeout(10_000),
    })
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'name' in err &&
        (err.name === 'TimeoutError' || err.name === 'AbortError')) {
      throw createError({ statusCode: 504, statusMessage: 'SFL timed out' })
    }
    if (err && typeof err === 'object' && 'statusCode' in err) throw err
    throw createError({ statusCode: 502, statusMessage: 'SFL network error' })
  }
  if (!res.ok && res.status !== 404) {
    throw createError({ statusCode: 502, statusMessage: `SFL delete failed (${res.status})` })
  }
}
