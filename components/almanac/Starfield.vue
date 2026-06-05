<template>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 100 100"
    preserveAspectRatio="none"
    aria-hidden="true"
    class="w-full h-full"
  >
    <circle cx="12" cy="22" r="0.7" fill="#ffffff" opacity="0.55" />
    <circle cx="88" cy="14" r="0.7" fill="#ffffff" opacity="0.35" />
    <circle cx="30" cy="88" r="0.7" fill="#ffffff" opacity="0.45" />
    <circle cx="70" cy="60" r="0.7" fill="#ffffff" opacity="0.25" />
    <circle cx="45" cy="42" r="0.7" fill="#ffffff" opacity="0.40" />
    <circle cx="62" cy="78" r="0.7" fill="#ffffff" opacity="0.30" />
  </svg>
</template>

<script setup lang="ts">
/**
 * Starfield — six hand-placed static dots, dark mode only.
 * Render gating (dark-only) is the caller's responsibility; app.vue mounts
 * this fixed behind content when prefers-color-scheme: dark.
 */
</script>
