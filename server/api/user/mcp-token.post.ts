import { defineEventHandler } from 'h3'
import { randomBytes } from 'crypto'
import { getAuthenticatedUser } from '~/server/utils/auth'
import { getSupabaseClient } from '~/server/utils/supabase'

/**
 * POST /api/user/mcp-token
 * Generate or regenerate MCP authentication token for the current user
 */
export default defineEventHandler(async (event) => {
  const user = await getAuthenticatedUser(event)
  const supabase = getSupabaseClient(event)

  // Generate a secure random token (64 hex characters = 32 bytes)
  const mcpToken = randomBytes(32).toString('hex')

  // Update user with new token
  const { data: updatedUser, error } = await supabase
    .from('User')
    .update({
      mcp_token: mcpToken,
      mcp_token_created_at: new Date().toISOString()
    })
    .eq('id', user.id)
    .select('id, email, mcp_token, mcp_token_created_at')
    .single()

  if (error) {
    throw createError({
      statusCode: 500,
      message: error.message
    })
  }

  return {
    success: true,
    token: updatedUser.mcp_token,
    createdAt: updatedUser.mcp_token_created_at
  }
})
