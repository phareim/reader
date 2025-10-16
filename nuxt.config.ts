// https://nuxt.com/docs/api/configuration/nuxt-config
const normalizeOrigin = (origin?: string | null) => origin?.replace(/\/+$/, '')
const envOrigin = process.env.AUTH_ORIGIN || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined)
const AUTH_ORIGIN = normalizeOrigin(envOrigin)
const AUTH_PATH = '/api/auth'
const AUTH_BASE_URL = AUTH_ORIGIN ? `${AUTH_ORIGIN}${AUTH_PATH}` : undefined

export default defineNuxtConfig({
  compatibilityDate: '2024-04-03',
  devtools: { enabled: true },

  modules: [
    '@nuxtjs/tailwindcss',
    '@sidebase/nuxt-auth'
  ],

  runtimeConfig: {
    authOrigin: AUTH_ORIGIN,
    public: {}
  },

  typescript: {
    strict: false,
    typeCheck: false
  },

  auth: {
    baseURL: AUTH_BASE_URL,
    originEnvKey: 'AUTH_ORIGIN',
    provider: {
      type: 'authjs',
      trustHost: true
    },
    globalAppMiddleware: false
  }
})
