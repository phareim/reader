/**
 * Minimal SFL API client for the elevate flow.
 *
 * SFL dedupes page ideas by URL: POST with an existing URL returns
 * `{existing: true, idea}` instead of creating — callers must treat
 * `existing` ideas as not-ours-to-delete on undo.
 */

interface SflConfig {
  url: string
  key: string
}

export function getSflConfig(): SflConfig {
  const config = useRuntimeConfig()
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
