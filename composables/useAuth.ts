import { authClient } from '~/lib/auth-client'

/**
 * Composable that wraps Better Auth's client to provide a similar API
 * to the old useUserSession() from nuxt-auth-utils.
 */
export const useAuth = () => {
  const session = authClient.useSession()

  const loggedIn = computed(() => !!session.value?.data?.user)
  const user = computed(() => session.value?.data?.user || null)

  const signInWithGoogle = () => {
    authClient.signIn.social({
      provider: 'google',
      callbackURL: '/',
    })
  }

  const signOut = async () => {
    await authClient.signOut()
  }

  return {
    session,
    loggedIn,
    user,
    signInWithGoogle,
    signOut,
  }
}
