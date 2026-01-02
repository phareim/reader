import { defineEventHandler } from 'h3'
import { getAuthenticatedUser } from '~/server/utils/auth'
import { getSupabaseClient } from '~/server/utils/supabase'

/**
 * DELETE /api/user/mcp-token
 * Revoke (delete) MCP authentication token for the current user
 */
export default defineEventHandler(async (event) => {
  const user = await getAuthenticatedUser(event)
  const supabase = getSupabaseClient(event)

  // Clear the token
  const { error } = await supabase
    .from('User')
    .update({
      mcp_token: null,
      mcp_token_created_at: null
    })
    .eq('id', user.id)

  if (error) {
    throw createError({
      statusCode: 500,
      message: error.message
    })
  }

  return {
    success: true,
    message: 'MCP token revoked successfully'
  }
})
