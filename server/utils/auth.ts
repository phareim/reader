import { H3Event, getHeader, createError } from 'h3'
import { getServerSession } from '#auth'
import prisma from '~/server/utils/db'

/**
 * Get authenticated user from either:
 * 1. MCP token (X-MCP-Token header) - looks up user by token in database
 * 2. Session cookie (next-auth)
 */
export async function getAuthenticatedUser(event: H3Event) {
  // Check for MCP token first
  const mcpToken = getHeader(event, 'x-mcp-token')

  if (mcpToken) {
    // Look up user by MCP token
    const user = await prisma.user.findUnique({
      where: { mcpToken }
    })

    if (!user) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Invalid MCP token'
      })
    }

    return user
  }

  // Fall back to session authentication
  const session = await getServerSession(event)
  if (!session || !session.user?.email) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized'
    })
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email }
  })

  if (!user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'User not found'
    })
  }

  return user
}
