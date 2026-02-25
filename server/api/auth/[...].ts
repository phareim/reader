import GoogleProvider from '@auth/core/providers/google'

const config = useRuntimeConfig()

export default NuxtAuthHandler({
  secret: config.auth.secret,
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
