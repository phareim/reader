/**
 * Minimal auth composable — email/password only.
 * Talks to our own /api/auth/* endpoints.
 */
let sessionRequest: Promise<void> | null = null

export const useAuth = () => {
  const user = useState<{ id: string; email: string; name: string; image?: string } | null>('auth_user', () => null)
  const loggedIn = computed(() => !!user.value)
  // True once the session check has completed (either way) — lets the UI
  // tell "still checking" apart from "actually signed out", so signed-out
  // states never flash during the initial load.
  const checked = useState<boolean>('auth_checked', () => false)
  // Allowlisted personal integrations (SFL elevate, highlight mirror,
  // read-aloud) — false for guest accounts, so the UI hides those verbs.
  const personal = useState<boolean>('auth_personal', () => false)

  const fetchSession = () => {
    // Every useAuth() caller shares one in-flight check — several components
    // mount at once and each used to fire its own /api/auth/session.
    sessionRequest ??= loadSession().finally(() => { sessionRequest = null })
    return sessionRequest
  }

  const loadSession = async () => {
    try {
      const res = await $fetch<{ user: any; features?: { personal?: boolean } }>('/api/auth/session')
      user.value = res.user
      personal.value = !!res.features?.personal
    } catch {
      user.value = null
      personal.value = false
    } finally {
      checked.value = true
    }
  }

  // Check the session on first use, client-side only: the server-side $fetch
  // carries no cookie, so it could only ever answer "signed out" (and did,
  // on every SSR render).
  if (import.meta.client && user.value === null && !checked.value) {
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

  const signUp = async (email: string, password: string, name?: string, inviteCode?: string) => {
    const res = await $fetch<{ user: any }>('/api/auth/sign-up', {
      method: 'POST',
      body: { email, password, name, inviteCode },
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
    checked,
    personal,
    fetchSession,
    signIn,
    signUp,
    signOut,
  }
}
