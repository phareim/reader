/**
 * composables/useAuth.ts reads `import.meta.client`, which the CommonJS output
 * Jest runs cannot parse. So the composable is compiled here with that flag
 * folded to `true` (the browser) and run against stand-ins for the Nuxt
 * auto-imports it uses (`useState`, `computed`, `$fetch`).
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import ts from 'typescript'
import { ref, computed } from 'vue'

type Fetch = (url: string, opts?: { method?: string; body?: unknown }) => Promise<any>

function loadUseAuth($fetch: Fetch) {
  const source = readFileSync(join(__dirname, '../../composables/useAuth.ts'), 'utf8')
    .replace(/import\.meta\.client/g, 'true')
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  })
  const state = new Map<string, any>()
  const useState = (key: string, init: () => unknown) => {
    if (!state.has(key)) state.set(key, ref(init()))
    return state.get(key)
  }
  const module = { exports: {} as any }
  new Function('module', 'exports', 'useState', 'computed', '$fetch', outputText)(
    module, module.exports, useState, computed, $fetch,
  )
  return module.exports.useAuth as () => any
}

const petter = { id: 'user-1', email: 'petter@example.com', name: 'Petter', image: null }

/** A server that knows one account; `signedIn` flips on sign-in/sign-out. */
function fakeServer(features: { personal: boolean }) {
  let signedIn = false
  const calls: string[] = []
  const $fetch: Fetch = async (url, opts) => {
    calls.push(`${opts?.method ?? 'GET'} ${url}`)
    if (url === '/api/auth/session') return signedIn ? { user: petter, features } : { user: null }
    if (url === '/api/auth/sign-in' || url === '/api/auth/sign-up') { signedIn = true; return { user: petter } }
    if (url === '/api/auth/sign-out') { signedIn = false; return { success: true } }
    throw new Error(`unexpected ${url}`)
  }
  return { $fetch, calls }
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0))

describe('useAuth', () => {
  it('checks the session once on first use and reports signed out', async () => {
    const { $fetch, calls } = fakeServer({ personal: true })
    const useAuth = loadUseAuth($fetch)

    const auth = useAuth()
    useAuth() // a second component mounting at the same time
    await settle()

    expect(calls).toEqual(['GET /api/auth/session'])
    expect(auth.checked.value).toBe(true)
    expect(auth.loggedIn.value).toBe(false)
    expect(auth.personal.value).toBe(false)
  })

  it('knows the account’s personal flag right after signing in with the local form', async () => {
    const { $fetch } = fakeServer({ personal: true })
    const auth = loadUseAuth($fetch)()
    await settle() // the signed-out check that /login runs on mount

    await auth.signIn('petter@example.com', 'correct horse 42')

    expect(auth.loggedIn.value).toBe(true)
    // Without this the deck hides Elevate until the app is reloaded.
    expect(auth.personal.value).toBe(true)
  })

  it('keeps a guest account non-personal after sign-up', async () => {
    const { $fetch } = fakeServer({ personal: false })
    const auth = loadUseAuth($fetch)()
    await settle()

    await auth.signUp('guest@example.com', 'a good password 1', undefined, 'invite')

    expect(auth.loggedIn.value).toBe(true)
    expect(auth.personal.value).toBe(false)
  })

  it('stays signed in when the follow-up flag check fails', async () => {
    const server = fakeServer({ personal: true })
    let failSession = false
    const $fetch: Fetch = (url, opts) =>
      url === '/api/auth/session' && failSession ? Promise.reject(new Error('offline')) : server.$fetch(url, opts)
    const auth = loadUseAuth($fetch)()
    await settle()

    failSession = true
    await auth.signIn('petter@example.com', 'correct horse 42')

    expect(auth.loggedIn.value).toBe(true)
    expect(auth.user.value).toEqual(petter)
  })

  it('drops the personal flag on sign-out', async () => {
    const { $fetch } = fakeServer({ personal: true })
    const auth = loadUseAuth($fetch)()
    await settle()
    await auth.signIn('petter@example.com', 'correct horse 42')

    await auth.signOut()

    expect(auth.loggedIn.value).toBe(false)
    expect(auth.personal.value).toBe(false)
  })
})
