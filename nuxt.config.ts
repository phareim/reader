// Stamped into the service worker's precache entry for '/' so the app shell
// refreshes on every deploy. With `revision: null`, Workbox pins the
// first-ever cached shell forever while each deploy purges the hashed chunks
// it references — the app then boots a stale shell pointing at 404'd JS and
// goes dead (this happened 2026-07-02).
const buildRevision = Date.now().toString(36)

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
        { rel: 'icon', type: 'image/png', href: '/favicon.png' },
        { rel: 'apple-touch-icon', sizes: '180x180', href: '/apple-touch-icon.png' },
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
    ttsApiUrl: '',  // NUXT_TTS_API_URL (reader-tts on Sleeper)
    ttsApiKey: '',  // NUXT_TTS_API_KEY
    inviteCode: '', // NUXT_INVITE_CODE (Worker secret) — sign-up is closed while unset
    personalEmails: '', // NUXT_PERSONAL_EMAILS — accounts with SFL elevate/highlight-mirror/TTS
    cronKey: '', // NUXT_CRON_KEY (Worker secret) — auth for /api/internal/sync-stale + sync-x-bookmarks
    emailIngestKey: '', // NUXT_EMAIL_INGEST_KEY (Worker secret) — auth for /api/internal/email-ingest (reader-email Worker)
    xClientId: '', // NUXT_X_CLIENT_ID — X OAuth2 app client id (link-your-X-account)
    xClientSecret: '', // NUXT_X_CLIENT_SECRET (Worker secret) — X OAuth2 app client secret
    redditClientId: '', // NUXT_REDDIT_CLIENT_ID — Reddit OAuth2 app client id (link-your-Reddit-account)
    redditClientSecret: '', // NUXT_REDDIT_CLIENT_SECRET (Worker secret) — Reddit OAuth2 app client secret
  },

  typescript: {
    strict: false,
    typeCheck: false
  },


  pwa: {
    // 'prompt': the new service worker waits until the user taps Reload in
    // PwaUpdatePrompt (which is built for exactly this mode). 'autoUpdate'
    // skipWaiting()s mid-session, purging the running build's chunks out of
    // the precache under the open app.
    registerType: 'prompt',
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
      // The SSR'd shell changes every deploy — see buildRevision above.
      additionalManifestEntries: [
        { url: '/', revision: buildRevision }
      ],
      globPatterns: ['**/*.{js,css,html,png,svg,ico}'],
      // Workbox tests urlPattern regexes against the FULL request URL
      // (https://…), so path-anchored /^\/api\/…/ patterns never match.
      runtimeCaching: [
        {
          urlPattern: ({ url }: { url: URL }) => url.pathname.startsWith('/api/articles'),
          handler: 'NetworkFirst',
          options: {
            cacheName: 'api-articles-cache',
            networkTimeoutSeconds: 5,
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
          urlPattern: ({ url }: { url: URL }) => url.pathname.startsWith('/api/feeds'),
          handler: 'NetworkFirst',
          options: {
            cacheName: 'api-feeds-cache',
            networkTimeoutSeconds: 5,
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
