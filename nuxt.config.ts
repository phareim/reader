// https://nuxt.com/docs/api/configuration/nuxt-config
const normalizeOrigin = (origin?: string | null) => origin?.replace(/\/+$/, '')
const envOrigin = process.env.AUTH_ORIGIN || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined)
const AUTH_ORIGIN = normalizeOrigin(envOrigin)

export default defineNuxtConfig({
  compatibilityDate: '2024-04-03',
  devtools: { enabled: true },

  css: ['~/assets/css/main.css'],

  app: {
    head: {
      title: 'The Librarian',
      meta: [
        { name: 'description', content: 'Your friendly librarian for organizing and curating the web\'s knowledge' }
      ],
      link: [
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
        { rel: 'apple-touch-icon', sizes: '180x180', href: '/apple-touch-icon.svg' },
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Spectral:ital,wght@0,200;0,300;0,400;0,500;0,600;0,700;0,800;1,200;1,300;1,400;1,500;1,600;1,700;1,800&display=swap' }
      ]
    }
  },

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
    baseURL: '/api/auth',
    provider: {
      type: 'authjs'
    },
    globalAppMiddleware: false
  },

  vite: {
    resolve: {
      alias: {
        'next-auth/core': 'next-auth/core'
      }
    }
  },

  components: {
    dirs: [
      {
        path: '~/components',
        pathPrefix: false
      }
    ]
  }
})
