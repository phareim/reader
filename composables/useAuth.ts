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
  // Allowlisted personal integrations (SFL elevate, highlight mirror) —
  // false for guest accounts, so the UI hides those verbs.
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
  // on every SSR render). On the signed-in-only rooms the login gate
  // (middleware/auth.global.ts) fills this state during SSR with the
  // request's cookie; then `checked` is already true here after hydration.
  if (import.meta.client && user.value === null && !checked.value) {
    fetchSession()
  }

  // The sign-in and sign-up answers carry no feature flags, so ask the session
  // for them: otherwise `personal` keeps the signed-out answer from the check
  // /login ran on mount, and Elevate stays hidden until the next full load.
  // A failed check keeps the fresh sign-in rather than undoing it.
  const loadFeatures = async () => {
    try {
      const res = await $fetch<{ user: any; features?: { personal?: boolean } }>('/api/auth/session')
      personal.value = !!res.features?.personal
    } catch {
      // the next full load asks again
    }
  }

  const signIn = async (email: string, password: string) => {
    const res = await $fetch<{ user: any }>('/api/auth/sign-in', {
      method: 'POST',
      body: { email, password },
    })
    user.value = res.user
    await loadFeatures()
    return res
  }

  const signUp = async (email: string, password: string, name?: string, inviteCode?: string) => {
    const res = await $fetch<{ user: any }>('/api/auth/sign-up', {
      method: 'POST',
      body: { email, password, name, inviteCode },
    })
    user.value = res.user
    await loadFeatures()
    return res
  }

  const signOut = async () => {
    await $fetch('/api/auth/sign-out', { method: 'POST' })
    user.value = null
    personal.value = false
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
