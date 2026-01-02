import { serverSupabaseClient, serverSupabaseServiceRole } from '#supabase/server'
import cuid from 'cuid'

/**
 * OAuth callback handler for Supabase Auth
 *
 * This route handles the redirect from Google OAuth and:
 * 1. Exchanges the authorization code for a session
 * 2. Creates an application User record if this is a new user
 * 3. Redirects to the home page
 */
export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const code = query.code as string

  if (!code) {
    console.error('Auth callback: Missing authorization code')
    return sendRedirect(event, '/login?error=no_code')
  }

  try {
    const supabase = await serverSupabaseClient(event)

    // Exchange code for session
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    if (error) {
      console.error('Auth callback error:', error)
      return sendRedirect(event, '/login?error=auth_failed')
    }

    // Check if application User record exists
    const supabaseService = serverSupabaseServiceRole(event)
    const { data: appUser } = await supabaseService
      .from('User')
      .select('id')
      .eq('auth_user_id', data.user.id)
      .single()

    // Create application User record if it doesn't exist (new user)
    if (!appUser) {
      console.log(`Creating application user record for ${data.user.email}`)

      const { error: insertError } = await supabaseService
        .from('User')
        .insert({
          id: cuid(),
          auth_user_id: data.user.id,
          email: data.user.email,
          name: data.user.user_metadata?.name || data.user.user_metadata?.full_name,
          image: data.user.user_metadata?.avatar_url || data.user.user_metadata?.picture,
          email_verified: data.user.email_confirmed_at
        })

      if (insertError) {
        console.error('Failed to create user record:', insertError)
        return sendRedirect(event, '/login?error=user_creation_failed')
      }

      console.log(`Successfully created user record for ${data.user.email}`)
    }

    // Successful authentication - redirect to home
    return sendRedirect(event, '/')
  } catch (error: any) {
    console.error('Auth callback exception:', error)
    return sendRedirect(event, '/login?error=server_error')
  }
})
