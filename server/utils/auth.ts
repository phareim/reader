import { H3Event, getHeader, createError } from 'h3'
import { getServerSession } from '#auth'
import cuid from 'cuid'
import { getD1 } from '~/server/utils/cloudflare'

/**
 * Get authenticated user from either:
 * 1. MCP token (X-MCP-Token header) - looks up user by token in database
 * 2. Auth.js session (cookie-based JWT)
 *
 * This dual authentication approach preserves MCP integration while
 * using Auth.js for browser-based authentication.
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

  // Fall back to Auth.js session authentication
  const session = await getServerSession(event)

  if (!session?.user?.email) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized'
    })
  }

  const db = getD1(event)
  let user = await db.prepare('SELECT * FROM "User" WHERE email = ?').bind(session.user.email).first()

  if (!user) {
    const newUserId = cuid()
    await db.prepare(`
      INSERT INTO "User" (id, name, email, image)
      VALUES (?, ?, ?, ?)
    `).bind(
      newUserId,
      session.user.name || null,
      session.user.email,
      session.user.image || null
    ).run()

    user = await db.prepare('SELECT * FROM "User" WHERE id = ?').bind(newUserId).first()
  }

  return user
}
