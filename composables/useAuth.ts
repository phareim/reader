import { authClient } from '~/lib/auth-client'

/**
 * Composable that wraps Better Auth's client to provide
 * email/password and Google OAuth authentication.
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

  const signIn = async (email: string, password: string) => {
    const result = await authClient.signIn.email({
      email,
      password,
    })
    if (result.error) {
      throw new Error(result.error.message || 'Sign in failed')
    }
    return result
  }

  const signUp = async (email: string, password: string, name?: string) => {
    const result = await authClient.signUp.email({
      email,
      password,
      name: name || email.split('@')[0],
    })
    if (result.error) {
      throw new Error(result.error.message || 'Sign up failed')
    }
    return result
  }

  const signOut = async () => {
    await authClient.signOut()
  }

  return {
    session,
    loggedIn,
    user,
    signIn,
    signUp,
    signInWithGoogle,
    signOut,
  }
}
