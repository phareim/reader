import { H3Event, getHeader, createError } from 'h3'
import { serverSupabaseUser, serverSupabaseServiceRole } from '#supabase/server'

/**
 * Get authenticated user from either:
 * 1. MCP token (X-MCP-Token header) - looks up user by token in database
 * 2. Supabase session (replaces NextAuth session)
 *
 * This dual authentication approach preserves MCP integration while
 * modernizing to Supabase Auth for browser-based authentication.
 */
export async function getAuthenticatedUser(event: H3Event) {
  // Check for MCP token first (preserve existing MCP functionality)
  const mcpToken = getHeader(event, 'x-mcp-token')

  if (mcpToken) {
    // Use service role client to bypass RLS for MCP token lookup
    const supabaseService = serverSupabaseServiceRole(event)

    const { data: user, error } = await supabaseService
      .from('User')
      .select('*')
      .eq('mcp_token', mcpToken)
      .single()

    if (error || !user) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Invalid MCP token'
      })
    }

    return user
  }

  // Fall back to Supabase session authentication
  const supabaseUser = await serverSupabaseUser(event)

  if (!supabaseUser) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized'
    })
  }

  // Get application user record by auth_user_id
  const supabaseClient = serverSupabaseServiceRole(event)
  const { data: user, error } = await supabaseClient
    .from('User')
    .select('*')
    .eq('auth_user_id', supabaseUser.id)
    .single()

  if (error || !user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'User not found'
    })
  }

  return user
}
