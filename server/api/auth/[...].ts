import GoogleProvider from '@auth/core/providers/google'
import { NuxtAuthHandler } from '#auth'

let authHandler: ReturnType<typeof NuxtAuthHandler> | null = null

export default defineEventHandler((event) => {
  if (!authHandler) {
    const config = useRuntimeConfig(event)
    const cloudflareEnv = (event.context as any)?.cloudflare?.env as Record<string, string | undefined> | undefined
    const googleClientId = config.auth.googleClientId || cloudflareEnv?.GOOGLE_CLIENT_ID || cloudflareEnv?.NUXT_AUTH_GOOGLE_CLIENT_ID || ''
    const googleClientSecret = config.auth.googleClientSecret || cloudflareEnv?.GOOGLE_CLIENT_SECRET || cloudflareEnv?.NUXT_AUTH_GOOGLE_CLIENT_SECRET || ''
    const providers = []

    if (googleClientId && googleClientSecret) {
      providers.push(
        GoogleProvider({
          clientId: googleClientId,
          clientSecret: googleClientSecret
        })
      )
    }
    else {
      console.error('[auth] Google OAuth provider is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET (or NUXT_AUTH_* equivalents).')
    }

    authHandler = NuxtAuthHandler({
      secret: config.auth.secret || 'dev-secret-do-not-use-in-production',
      origin: config.public.authOrigin,
      trustHost: true,
      providers,
      session: {
        strategy: 'jwt'
      }
    })
  }
  return authHandler(event)
})
