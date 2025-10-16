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
      }
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
}
