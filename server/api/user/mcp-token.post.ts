import { defineEventHandler } from 'h3'
import { randomBytes } from 'crypto'
import { getAuthenticatedUser } from '~/server/utils/auth'
import { getD1 } from '~/server/utils/cloudflare'

/**
 * POST /api/user/mcp-token
 * Generate or regenerate MCP authentication token for the current user
 */
export default defineEventHandler(async (event) => {
  const user = await getAuthenticatedUser(event)
  const db = getD1(event)

  // Generate a secure random token (64 hex characters = 32 bytes)
  const mcpToken = randomBytes(32).toString('hex')

  // Update user with new token
  await db.prepare(
    `
    UPDATE "User"
    SET mcp_token = ?, mcp_token_created_at = ?
    WHERE id = ?
    `
  ).bind(mcpToken, new Date().toISOString(), user.id).run()

  const updatedUser = await db.prepare(
    `
    SELECT id, email, mcp_token, mcp_token_created_at
    FROM "User"
    WHERE id = ?
    `
  ).bind(user.id).first()

  if (!updatedUser) {
    throw createError({
      statusCode: 500,
      message: 'Failed to update MCP token'
    })
  }

  return {
    success: true,
    token: updatedUser.mcp_token,
    createdAt: updatedUser.mcp_token_created_at
  }
})
