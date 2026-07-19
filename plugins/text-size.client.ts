export default defineNuxtPlugin(() => {
  // Hydrating the composable applies the stored text size to <html>,
  // so the preference holds on every page load — not just after
  // visiting Sources.
  useTextSize()
})
