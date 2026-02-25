import { defineEventHandler } from 'h3'
import { getAuthenticatedUser } from '~/server/utils/auth'
import { getD1 } from '~/server/utils/cloudflare'

/**
 * DELETE /api/user/mcp-token
 * Revoke (delete) MCP authentication token for the current user
 */
export default defineEventHandler(async (event) => {
  const user = await getAuthenticatedUser(event)
  const db = getD1(event)

  // Clear the token
  await db.prepare(
    `
    UPDATE "User"
    SET mcp_token = NULL, mcp_token_created_at = NULL
    WHERE id = ?
    `
  ).bind(user.id).run()

  return {
    success: true,
    message: 'MCP token revoked successfully'
  }
})
