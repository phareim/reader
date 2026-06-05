/** @type {import('tailwindcss').Config} */
const plugin = require('tailwindcss/plugin')

module.exports = {
  darkMode: 'media', // Honors system preference (prefers-color-scheme)
  presets: [
    require('./config/almanac.preset.cjs'),
  ],
  content: [
    "./components/**/*.{js,vue,ts}",
    "./layouts/**/*.vue",
    "./pages/**/*.vue",
    "./plugins/**/*.{js,ts}",
    "./app.vue",
  ],
  theme: {
    extend: {
      typography: () => ({
        DEFAULT: {
          css: {
            fontFamily: 'var(--almanac-serif)',
            color: 'var(--almanac-fg)',
            maxWidth: 'var(--almanac-measure)',
            h1: { fontFamily: 'var(--almanac-serif)', color: 'var(--almanac-fg)' },
            h2: { fontFamily: 'var(--almanac-serif)', color: 'var(--almanac-fg)' },
            h3: { fontFamily: 'var(--almanac-serif)', color: 'var(--almanac-fg)' },
            h4: { fontFamily: 'var(--almanac-serif)', color: 'var(--almanac-fg)' },
            a: { color: 'var(--almanac-accent)' },
            'blockquote p': { fontFamily: 'var(--almanac-serif)' },
            hr: { borderColor: 'var(--almanac-rule-line)' },
          },
        },
      }),
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
    // The Almanac MonoLabel utility — 9px tracked uppercase mono, accent
    // color, dark-mode glow. The Almanac substitute for chrome.
    plugin(function ({ addComponents }) {
      addComponents({
        '.mono-label': {
          fontFamily: 'var(--almanac-mono)',
          fontSize: 'var(--almanac-size-monolabel)',
          letterSpacing: 'var(--almanac-track-monolabel)',
          textTransform: 'uppercase',
          color: 'var(--almanac-accent)',
          textShadow: '0 0 4px var(--almanac-glow)',
          fontWeight: '500',
        },
      })
    }),
  ],
}
