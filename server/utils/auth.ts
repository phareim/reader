import { H3Event, getHeader, createError } from 'h3'
import { getD1 } from '~/server/utils/cloudflare'
import { getAuth } from '~/server/utils/better-auth'

/**
 * Get authenticated user from either:
 * 1. MCP token (X-MCP-Token header) - looks up user by token in database
 * 2. Better Auth session (cookie-based)
 *
 * This dual authentication approach preserves MCP integration while
 * using Better Auth for browser-based authentication.
 */
export async function getAuthenticatedUser(event: H3Event) {
  // Check for MCP token first (preserve existing MCP functionality)
  const mcpToken = getHeader(event, 'x-mcp-token')

  if (mcpToken) {
    const db = getD1(event)
    const result = await db.prepare('SELECT * FROM "User" WHERE mcp_token = ?').bind(mcpToken).first()

    if (!result) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Invalid MCP token'
      })
    }

    return result
  }

  // Fall back to Better Auth session authentication
  const auth = getAuth(event)
  const session = await auth.api.getSession({
    headers: event.headers
  })

  if (!session?.user?.email) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized'
    })
  }

  // Better Auth manages user creation via the account/session tables,
  // but we still need to look up the user in our User table for app-specific fields
  const db = getD1(event)
  const user = await db.prepare('SELECT * FROM "User" WHERE email = ?').bind(session.user.email).first()

  if (!user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized'
    })
  }

  return user
}
