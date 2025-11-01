import { H3Event, getHeader, createError } from 'h3'
import { getServerSession } from '#auth'
import prisma from '~/server/utils/db'

/**
 * Get authenticated user from either:
 * 1. MCP token (X-MCP-Token header)
 * 2. Session cookie (next-auth)
 */
export async function getAuthenticatedUser(event: H3Event) {
  // Check for MCP token first
  const mcpToken = getHeader(event, 'x-mcp-token')
  const validMcpToken = process.env.MCP_TOKEN

  if (mcpToken && validMcpToken && mcpToken === validMcpToken) {
    // MCP token is valid - get user by email from env
    const mcpUserEmail = process.env.MCP_USER_EMAIL

    if (!mcpUserEmail) {
      throw createError({
        statusCode: 500,
        statusMessage: 'MCP_USER_EMAIL not configured'
      })
    }

    const user = await prisma.user.findUnique({
      where: { email: mcpUserEmail }
    })

    if (!user) {
      throw createError({
        statusCode: 401,
        statusMessage: 'MCP user not found'
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
