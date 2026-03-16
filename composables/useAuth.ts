/**
 * Minimal auth composable — email/password only.
 * Talks to our own /api/auth/* endpoints.
 */
export const useAuth = () => {
  const user = useState<{ id: string; email: string; name: string; image?: string } | null>('auth_user', () => null)
  const loggedIn = computed(() => !!user.value)

  const fetchSession = async () => {
    try {
      const res = await $fetch<{ user: any }>('/api/auth/session')
      user.value = res.user
    } catch {
      user.value = null
    }
  }

  // Fetch session on first call (SSR + client)
  if (user.value === null) {
    fetchSession()
  }

  const signIn = async (email: string, password: string) => {
    const res = await $fetch<{ user: any }>('/api/auth/sign-in', {
      method: 'POST',
      body: { email, password },
    })
    user.value = res.user
    return res
  }

  const signUp = async (email: string, password: string, name?: string) => {
    const res = await $fetch<{ user: any }>('/api/auth/sign-up', {
      method: 'POST',
      body: { email, password, name },
    })
    user.value = res.user
    return res
  }

  const signOut = async () => {
    await $fetch('/api/auth/sign-out', { method: 'POST' })
    user.value = null
  }

  return {
    user,
    loggedIn,
    fetchSession,
    signIn,
    signUp,
    signOut,
  }
}
