// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2024-04-03',
  devtools: { enabled: true },

  // Tufte base layer first (fonts + tokens + dark palette), then the app's
  // own main.css can override on top.
  css: ['~/assets/css/tufte.css', '~/assets/css/main.css'],

  app: {
    head: {
      title: 'The Reader',
      meta: [
        { name: 'description', content: 'A calm reading room' },
        // viewport-fit=cover is required for env(safe-area-inset-*) to resolve
        // to non-zero on notched iPhones — the BottomBar relies on it.
        { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
        { name: 'theme-color', content: '#fbf9f4' },
      ],
      link: [
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
        { rel: 'apple-touch-icon', sizes: '180x180', href: '/apple-touch-icon.svg' },
      ]
    }
  },

  modules: [
    '@nuxtjs/tailwindcss',
    '@vite-pwa/nuxt'
  ],

  nitro: {
    preset: 'cloudflare-module'
  },

  runtimeConfig: {
    sflApiUrl: '',  // NUXT_SFL_API_URL
    sflApiKey: '',  // NUXT_SFL_API_KEY
  },

  typescript: {
    strict: false,
    typeCheck: false
  },


  pwa: {
    registerType: 'autoUpdate',
    disable: false,
    manifest: {
      name: 'The Reader',
      short_name: 'Reader',
      description: 'A calm reading room',
      theme_color: '#fbf9f4',
      background_color: '#fbf9f4',
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
      navigateFallbackDenylist: [/^\/auth\//, /^\/api\//],
      additionalManifestEntries: [
        { url: '/', revision: null }
      ],
      globPatterns: ['**/*.{js,css,html,png,svg,ico}'],
      runtimeCaching: [
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
      enabled: false,
      type: 'module'
    }
  },


  components: {
    dirs: [
      // Tufte shared primitives auto-imported WITHOUT a path prefix so they
      // are <MonoLabel>, <CardFrame>, etc. (NOT <TufteMonoLabel>).
      {
        path: '~/components/tufte',
        pathPrefix: false
      },
      {
        path: '~/components',
        pathPrefix: false
      }
    ]
  }
})
