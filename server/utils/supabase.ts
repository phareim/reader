import { H3Event } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'

/**
 * Get Supabase client with service role (full access, bypasses RLS)
 *
 * We use the service role client for all queries because:
 * 1. We're doing manual userId filtering in code (no RLS policies)
 * 2. Simpler migration path from Prisma
 * 3. MCP token authentication requires service role access
 *
 * All queries should filter by user.id to ensure data isolation.
 */
export function getSupabaseClient(event: H3Event) {
  return serverSupabaseServiceRole(event)
}
