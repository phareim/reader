/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'media', // Honors system preference
  content: [
    "./components/**/*.{js,vue,ts}",
    "./layouts/**/*.vue",
    "./pages/**/*.vue",
    "./plugins/**/*.{js,ts}",
    "./app.vue",
  ],
  theme: {
    extend: {
      colors: {
        gray: {
          850: '#1a1d23',
        }
      },
      fontFamily: {
        'sans': ['Spectral', 'serif'],
        'spectral': ['Spectral', 'serif'],
      },
      typography: (theme) => ({
        DEFAULT: {
          css: {
            fontFamily: 'Spectral, serif',
            h1: { fontFamily: 'Spectral, serif' },
            h2: { fontFamily: 'Spectral, serif' },
            h3: { fontFamily: 'Spectral, serif' },
            h4: { fontFamily: 'Spectral, serif' },
            'blockquote p': { fontFamily: 'Spectral, serif' },
          },
        },
      }),
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
}
