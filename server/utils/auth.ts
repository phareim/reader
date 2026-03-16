import { H3Event, getHeader, createError } from 'h3'
import { getD1 } from '~/server/utils/cloudflare'
import { getSessionUser } from '~/server/utils/session'

/**
 * Get authenticated user from either:
 * 1. MCP token (X-MCP-Token header)
 * 2. Session cookie
 */
export async function getAuthenticatedUser(event: H3Event) {
  // Check for MCP token first
  const mcpToken = getHeader(event, 'x-mcp-token')

  if (mcpToken) {
    const db = getD1(event)
    const result = await db.prepare('SELECT * FROM "User" WHERE mcp_token = ?').bind(mcpToken).first()

    if (!result) {
      throw createError({ statusCode: 401, statusMessage: 'Invalid MCP token' })
    }

    return result
  }

  // Fall back to session cookie
  const user = await getSessionUser(event)

  if (!user) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  return user
}

/**
 * Try to get authenticated user without throwing.
 * Returns null if not authenticated.
 */
export async function getOptionalUser(event: H3Event) {
  const mcpToken = getHeader(event, 'x-mcp-token')

  if (mcpToken) {
    const db = getD1(event)
    return await db.prepare('SELECT * FROM "User" WHERE mcp_token = ?').bind(mcpToken).first()
  }

  return await getSessionUser(event)
}
