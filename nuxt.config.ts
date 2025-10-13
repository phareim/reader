// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2024-04-03',
  devtools: { enabled: true },

  modules: [
    '@nuxtjs/tailwindcss',
    '@sidebase/nuxt-auth'
  ],

  typescript: {
    strict: false,
    typeCheck: false
  },

  auth: {
    provider: {
      type: 'authjs'
    },
    globalAppMiddleware: false
  }
})
