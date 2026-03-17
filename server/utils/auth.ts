import { H3Event, getHeader, createError } from 'h3'

export function toPublicUser(user: any) {
  return { id: user.id, email: user.email, name: user.name, image: user.image || null }
}
import { getD1 } from '~/server/utils/cloudflare'
import { getSessionUser } from '~/server/utils/session'

/**
 * Try to get authenticated user without throwing.
 * Returns null if not authenticated.
 */
export async function getOptionalUser(event: H3Event) {
  // Check for MCP token first
  const mcpToken = getHeader(event, 'x-mcp-token')

  if (mcpToken) {
    const db = getD1(event)
    return await db.prepare('SELECT * FROM "User" WHERE mcp_token = ?').bind(mcpToken).first()
  }

  // Fall back to session cookie
  return await getSessionUser(event)
}

/**
 * Get authenticated user from either:
 * 1. MCP token (X-MCP-Token header)
 * 2. Session cookie
 * Throws 401 if not authenticated.
 */
export async function getAuthenticatedUser(event: H3Event) {
  const user = await getOptionalUser(event)

  if (!user) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  return user
}
