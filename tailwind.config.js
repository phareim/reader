/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'media',
  presets: [
    require('./config/tufte.preset.cjs'),
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
            fontFamily: "'et-book', Charter, Palatino, Georgia, serif",
            color: 'var(--text-body)',
            maxWidth: '65ch',
            fontSize: '1.0625rem',
            lineHeight: '1.6',
            h1: { color: 'var(--text-strong)', fontWeight: '400' },
            h2: { color: 'var(--text-strong)', fontWeight: '400' },
            h3: { color: 'var(--text-strong)', fontWeight: '400' },
            h4: { color: 'var(--text-strong)', fontWeight: '400' },
            strong: { color: 'var(--text-strong)' },
            a: { color: 'var(--text-accent)', textDecorationThickness: '1px', textUnderlineOffset: '2px' },
            blockquote: { color: 'var(--text-muted)', borderLeftColor: 'var(--border-rule)', fontStyle: 'italic' },
            hr: { borderColor: 'var(--border-rule)' },
            code: { color: 'var(--text-strong)', backgroundColor: 'var(--surface-sunk)' },
            pre: { backgroundColor: 'var(--surface-sunk)', color: 'var(--text-body)' },
            img: { filter: 'saturate(.9)' },
            figcaption: { color: 'var(--text-muted)' },
          },
        },
      }),
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
}
