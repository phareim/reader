// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2024-04-03',
  devtools: { enabled: true },

  // Almanac base layer first (fonts + tokens + dark palette), then the app's
  // own main.css can override on top.
  css: ['~/assets/css/almanac.css', '~/assets/css/main.css'],

  app: {
    head: {
      title: 'The Librarian',
      meta: [
        { name: 'description', content: 'Your friendly librarian for organizing and curating the web\'s knowledge' }
      ],
      link: [
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
        { rel: 'apple-touch-icon', sizes: '180x180', href: '/apple-touch-icon.svg' },
        // Vendored Almanac design-system stylesheets (CSS-var palette +
        // component layer). The repo-local assets/css/almanac.css mirrors the
        // tokens so the app works even if these are cached/late.
        { rel: 'stylesheet', href: '/almanac/tokens/tokens.css' },
        { rel: 'stylesheet', href: '/almanac/components-web/almanac.css' }
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

  runtimeConfig: {},

  typescript: {
    strict: false,
    typeCheck: false
  },


  pwa: {
    registerType: 'autoUpdate',
    disable: true,
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
      navigateFallbackDenylist: [/^\/auth\//, /^\/api\//],
      additionalManifestEntries: [
        { url: '/', revision: null }
      ],
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
      enabled: false,
      type: 'module'
    }
  },


  components: {
    dirs: [
      // Almanac shared primitives auto-imported WITHOUT a path prefix so they
      // are <MonoLabel>, <PaperPanel>, etc. (NOT <AlmanacMonoLabel>).
      {
        path: '~/components/almanac',
        pathPrefix: false
      },
      {
        path: '~/components',
        pathPrefix: false
      }
    ]
  }
})
