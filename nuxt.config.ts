// https://nuxt.com/docs/api/configuration/nuxt-config
const normalizeOrigin = (origin?: string | null) => origin?.replace(/\/+$/, '')
const envOrigin = process.env.AUTH_ORIGIN || (process.env.CF_PAGES_URL ? `https://${process.env.CF_PAGES_URL}` : undefined)
const AUTH_ORIGIN = normalizeOrigin(envOrigin) || 'http://localhost:3000'

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
    '@sidebase/nuxt-auth',
    '@nuxtjs/tailwindcss',
    '@vite-pwa/nuxt'
  ],

  nitro: {
    preset: 'cloudflare-module'
  },

  runtimeConfig: {
    auth: {
      secret: process.env.AUTH_SECRET,
      googleClientId: process.env.GOOGLE_CLIENT_ID,
      googleClientSecret: process.env.GOOGLE_CLIENT_SECRET
    },
    public: {
      authOrigin: AUTH_ORIGIN
    }
  },

  auth: {
    baseURL: `${AUTH_ORIGIN}/api/auth`
  },

  typescript: {
    strict: false,
    typeCheck: false
  },


  pwa: {
    registerType: 'autoUpdate',
    manifest: {
      name: 'The Librarian',
      short_name: 'Librarian',
      description: 'Your friendly librarian for organizing and curating the web\'s knowledge',
      theme_color: '#1f2937',
      background_color: '#111827',
      icons: [
        {
          src: 'pwa-192x192.png',
          sizes: '192x192',
          type: 'image/png'
        },
        {
          src: 'pwa-512x512.png',
          sizes: '512x512',
          type: 'image/png'
        },
        {
          src: 'pwa-512x512.png',
          sizes: '512x512',
          type: 'image/png',
          purpose: 'any maskable'
        }
      ]
    },
    workbox: {
      navigateFallback: '/',
      navigateFallbackDenylist: [/^\/auth\/callback/, /^\/api\//],
      globPatterns: ['**/*.{js,css,html,png,svg,ico}'],
      runtimeCaching: [
        {
          urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
          handler: 'CacheFirst',
          options: {
            cacheName: 'google-fonts-cache',
            expiration: {
              maxEntries: 10,
              maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
            },
            cacheableResponse: {
              statuses: [0, 200]
            }
          }
        },
        {
          urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
          handler: 'CacheFirst',
          options: {
            cacheName: 'gstatic-fonts-cache',
            expiration: {
              maxEntries: 10,
              maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
            },
            cacheableResponse: {
              statuses: [0, 200]
            }
          }
        },
        {
          urlPattern: /^\/api\/articles.*/i,
          handler: 'NetworkFirst',
          options: {
            cacheName: 'api-articles-cache',
            expiration: {
              maxEntries: 50,
              maxAgeSeconds: 60 * 60 * 24 // 24 hours
            },
            cacheableResponse: {
              statuses: [0, 200]
            }
          }
        },
        {
          urlPattern: /^\/api\/feeds.*/i,
          handler: 'NetworkFirst',
          options: {
            cacheName: 'api-feeds-cache',
            expiration: {
              maxEntries: 20,
              maxAgeSeconds: 60 * 60 * 24 // 24 hours
            },
            cacheableResponse: {
              statuses: [0, 200]
            }
          }
        }
      ]
    },
    client: {
      installPrompt: true,
      periodicSyncForUpdates: 3600 // Check for updates every hour
    },
    devOptions: {
      enabled: true,
      type: 'module'
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
