/**
 * Supabase authentication composable
 * Replaces useAuth() from @sidebase/nuxt-auth
 * Provides a compatible API with the old NextAuth implementation
 */
export const useSupabaseAuth = () => {
  const supabaseUser = useSupabaseUser()
  const client = useSupabaseClient()

  // Wrap supabaseUser in a session object to match NextAuth API
  const data = computed(() => {
    if (!supabaseUser.value) return null
    return {
      user: {
        id: supabaseUser.value.id,
        email: supabaseUser.value.email,
        name: supabaseUser.value.user_metadata?.name || supabaseUser.value.user_metadata?.full_name,
        image: supabaseUser.value.user_metadata?.avatar_url
      }
    }
  })

  // signIn accepts provider name and options for API compatibility
  // but we always use Google since that's the only provider configured
  const signIn = async (provider?: string, options?: { callbackUrl?: string }) => {
    const { error } = await client.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`
      }
    })

    if (error) throw error
  }

  // signOut accepts options for API compatibility
  const signOut = async (options?: { callbackUrl?: string }) => {
    const { error } = await client.auth.signOut()
    if (error) throw error

    const redirectTo = options?.callbackUrl || '/login'
    await navigateTo(redirectTo)
  }

  return {
    data,
    signIn,
    signOut,
    status: computed(() => supabaseUser.value ? 'authenticated' : 'unauthenticated')
  }
}

// Also export as useAuth for backward compatibility
export const useAuth = useSupabaseAuth
