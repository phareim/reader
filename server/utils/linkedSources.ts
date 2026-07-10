import { H3Event } from 'h3'
import { getD1 } from '~/server/utils/cloudflare'

/**
 * LinkedSource — one row per (user, source) for every account connected on
 * /sources (X, Reddit, Hacker News, ...). OAuth sources keep their token
 * set in the credentials JSON; public sources carry NULL credentials.
 * The internal sync endpoint is the only writer of credentials after the
 * initial link (both X and Reddit rotate refresh tokens).
 */

export type SourceKey = 'x' | 'reddit' | 'hackernews'
export const SOURCE_KEYS: SourceKey[] = ['x', 'reddit', 'hackernews']

export type OauthCredentials = {
  access_token: string
  refresh_token: string
  obtained_at: number // unix seconds
  expires_in: number
}

export type LinkedSourceRow = {
  id: number
  user_id: string
  source: SourceKey
  external_id: string | null
  handle: string | null
  credentials: string | null
  last_sync_at: string | null
  last_error: string | null
}

export async function getLinkedSource(
  event: H3Event,
  userId: string,
  source: SourceKey
): Promise<LinkedSourceRow | null> {
  return await getD1(event).prepare(
    `SELECT * FROM "LinkedSource" WHERE user_id = ? AND source = ?`
  ).bind(userId, source).first<LinkedSourceRow>()
}

export async function listLinkedSources(event: H3Event, userId: string): Promise<LinkedSourceRow[]> {
  const { results } = await getD1(event).prepare(
    `SELECT * FROM "LinkedSource" WHERE user_id = ?`
  ).bind(userId).all<LinkedSourceRow>()
  return results ?? []
}

export async function listAllLinkedSources(event: H3Event): Promise<LinkedSourceRow[]> {
  const { results } = await getD1(event).prepare(`SELECT * FROM "LinkedSource"`).all<LinkedSourceRow>()
  return results ?? []
}

export async function upsertLinkedSource(
  event: H3Event,
  row: {
    userId: string
    source: SourceKey
    externalId?: string | null
    handle?: string | null
    credentials?: object | null
  }
): Promise<void> {
  await getD1(event).prepare(
    `
    INSERT INTO "LinkedSource" (user_id, source, external_id, handle, credentials, last_error)
    VALUES (?, ?, ?, ?, ?, NULL)
    ON CONFLICT(user_id, source) DO UPDATE SET
      external_id = excluded.external_id,
      handle = excluded.handle,
      credentials = excluded.credentials,
      last_error = NULL
    `
  ).bind(
    row.userId,
    row.source,
    row.externalId ?? null,
    row.handle ?? null,
    row.credentials ? JSON.stringify(row.credentials) : null
  ).run()
}

export async function updateLinkedSourceCredentials(
  event: H3Event,
  id: number,
  credentials: object
): Promise<void> {
  await getD1(event).prepare(
    `UPDATE "LinkedSource" SET credentials = ? WHERE id = ?`
  ).bind(JSON.stringify(credentials), id).run()
}

export async function recordSyncResult(event: H3Event, id: number, error?: string): Promise<void> {
  if (error) {
    await getD1(event).prepare(
      `UPDATE "LinkedSource" SET last_error = ? WHERE id = ?`
    ).bind(error.slice(0, 500), id).run()
  } else {
    await getD1(event).prepare(
      `UPDATE "LinkedSource" SET last_sync_at = ?, last_error = NULL WHERE id = ?`
    ).bind(new Date().toISOString(), id).run()
  }
}

export async function deleteLinkedSource(
  event: H3Event,
  userId: string,
  source: SourceKey
): Promise<void> {
  await getD1(event).prepare(
    `DELETE FROM "LinkedSource" WHERE user_id = ? AND source = ?`
  ).bind(userId, source).run()
}

export function parseCredentials(row: LinkedSourceRow): OauthCredentials | null {
  if (!row.credentials) return null
  try {
    return JSON.parse(row.credentials)
  } catch {
    return null
  }
}
