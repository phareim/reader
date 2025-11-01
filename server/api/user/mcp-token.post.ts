import { defineEventHandler } from 'h3'
import { randomBytes } from 'crypto'
import { getAuthenticatedUser } from '~/server/utils/auth'
import prisma from '~/server/utils/db'

/**
 * POST /api/user/mcp-token
 * Generate or regenerate MCP authentication token for the current user
 */
export default defineEventHandler(async (event) => {
  const user = await getAuthenticatedUser(event)

  // Generate a secure random token (64 hex characters = 32 bytes)
  const mcpToken = randomBytes(32).toString('hex')

  // Update user with new token
  const updatedUser = await prisma.user.update({
    where: { id: user.id },
    data: {
      mcpToken,
      mcpTokenCreatedAt: new Date()
    },
    select: {
      id: true,
      email: true,
      mcpToken: true,
      mcpTokenCreatedAt: true
    }
  })

  return {
    success: true,
    token: updatedUser.mcpToken,
    createdAt: updatedUser.mcpTokenCreatedAt
  }
})
