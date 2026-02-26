import GoogleProvider from '@auth/core/providers/google'
import { NuxtAuthHandler } from '#auth'

const config = useRuntimeConfig()

export default NuxtAuthHandler({
  secret: config.auth.secret,
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
