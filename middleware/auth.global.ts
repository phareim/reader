/**
 * Reader's login gate (Reader owns its login; the sibling apps bounce here).
 *
 * Server (the first request of a visit): asks Reader's own /api/auth/session
 * with the request's cookie and stores the answer in useAuth's state, so the
 * client does not ask again after hydration. On a signed-in-only room a
 * definite `{ user: null }` answers 302 to /login?redirect=<this page> before
 * any page code runs (on reader.phareim.no, server/middleware/loginHandover.ts
 * then hands that full load of /login to auth.phareim.no). When the check
 * itself fails (throws, 5xx, D1 down) the server does NOT redirect: the page
 * renders and the client decides, so a hiccup can never bounce a signed-in
 * reader to the login.
 *
 * Client (in-app navigation, or after a failed server check): the same check
 * with $fetch, then an in-app navigation to /login — which keeps the local
 * form inside the installed PWA (see pages/login.vue).
 *
 * Public: `/` (the signed-out doorstep, also the PWA's start page) and
 * `/login`. Paths that match no page keep their 404. Every API route is still
 * guarded on its own; this gate only spares the shell and the 401s.
 */
const PUBLIC_PATHS = new Set(['/', '/login'])

type SessionAnswer = { user: any; features?: { personal?: boolean } }

export default defineNuxtRouteMiddleware(async (to) => {
  // Public pages keep their client-side check and get no server verdict: the
  // service worker precaches the `/` shell and serves it cache-first, so a
  // session answer baked into its payload would go stale (an installed PWA
  // stuck on the doorstep, or showing a signed-out reader as signed in).
  // /login stays exactly as it was: its own page logic decides.
  if (PUBLIC_PATHS.has(to.path) || to.matched.length === 0) return

  const { user, checked, personal, fetchSession } = useAuth()
  const login = { path: '/login', query: { redirect: to.fullPath } }

  if (import.meta.server) {
    if (!checked.value) {
      let data: SessionAnswer | undefined
      try {
        data = await useRequestFetch()<SessionAnswer>('/api/auth/session')
      } catch {
        return // check failed: no verdict, leave it to the client
      }
      if (!data || typeof data !== 'object' || !('user' in data)) return // not an answer
      user.value = data.user ?? null
      personal.value = !!data.features?.personal
      checked.value = true
    }
    if (!user.value) {
      return navigateTo(login, { redirectCode: 302 })
    }
    return
  }

  if (!checked.value) {
    await fetchSession()
  }
  if (!user.value) {
    return navigateTo(login)
  }
})
