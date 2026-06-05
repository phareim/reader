<template>
  <div class="relative min-h-screen bg-paper text-ink font-serif">
    <!-- Night-sky starfield — dark mode only, decorative, behind all content. -->
    <ClientOnly>
      <Starfield v-if="isDark" aria-hidden="true" class="fixed inset-0 z-0 pointer-events-none" />
    </ClientOnly>

    <div class="relative z-10">
      <NuxtPage />
    </div>

    <ClientOnly>
      <PwaUpdatePrompt />
    </ClientOnly>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

// Dark mode is driven entirely by the OS preference — no manual toggle.
// We mirror that preference onto <html data-theme> for completeness so any
// [data-theme="dark"] selectors resolve, and gate the Starfield render.
const isDark = ref(false)

let mql: MediaQueryList | null = null

function apply(matches: boolean) {
  isDark.value = matches
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('data-theme', matches ? 'dark' : 'light')
  }
}

function onChange(e: MediaQueryListEvent) {
  apply(e.matches)
}

onMounted(() => {
  if (typeof window === 'undefined' || !window.matchMedia) return
  mql = window.matchMedia('(prefers-color-scheme: dark)')
  apply(mql.matches)
  mql.addEventListener('change', onChange)
})

onUnmounted(() => {
  mql?.removeEventListener('change', onChange)
})
</script>
