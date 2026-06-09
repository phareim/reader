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
  const res = await fetch(`${cfg.url}/api/ideas`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${cfg.key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ type: 'page', title: page.title, url: page.url }),
  })
  if (!res.ok) {
    throw createError({ statusCode: 502, statusMessage: `SFL create failed (${res.status})` })
  }
  const body = await res.json() as { idea: { id: string }; existing?: boolean }
  return { ideaId: body.idea.id, existing: Boolean(body.existing) }
}

export async function deleteIdea(cfg: SflConfig, ideaId: string): Promise<void> {
  const res = await fetch(`${cfg.url}/api/ideas/${encodeURIComponent(ideaId)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${cfg.key}` },
  })
  if (!res.ok && res.status !== 404) {
    throw createError({ statusCode: 502, statusMessage: `SFL delete failed (${res.status})` })
  }
}
