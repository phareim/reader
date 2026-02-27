import GoogleProvider from '@auth/core/providers/google'
import { NuxtAuthHandler } from '#auth'

let authHandler: ReturnType<typeof NuxtAuthHandler> | null = null

export default defineEventHandler((event) => {
  if (!authHandler) {
    const config = useRuntimeConfig(event)
    authHandler = NuxtAuthHandler({
      secret: config.auth.secret || 'dev-secret-do-not-use-in-production',
      origin: config.public.authOrigin,
      trustHost: true,
      providers: [
        GoogleProvider({
          clientId: config.auth.googleClientId || '',
          clientSecret: config.auth.googleClientSecret || ''
        })
      ],
      session: {
        strategy: 'jwt'
      }
    })
  }
  return authHandler(event)
})
