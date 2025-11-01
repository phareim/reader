import { defineEventHandler } from 'h3'
import { getAuthenticatedUser } from '~/server/utils/auth'
import prisma from '~/server/utils/db'

/**
 * DELETE /api/user/mcp-token
 * Revoke (delete) MCP authentication token for the current user
 */
export default defineEventHandler(async (event) => {
  const user = await getAuthenticatedUser(event)

  // Clear the token
  await prisma.user.update({
    where: { id: user.id },
    data: {
      mcpToken: null,
      mcpTokenCreatedAt: null
    }
  })

  return {
    success: true,
    message: 'MCP token revoked successfully'
  }
})
