<template>
  <span class="inline-block text-ink" :style="{ width: size, height: glyphHeight }" aria-hidden="true">
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 56 40"
      class="block w-full h-full"
      role="img"
      aria-label="Almanac mark"
      fill="none"
    >
      <!-- inner circle, 38u diameter -->
      <circle cx="28" cy="20" r="18.5" stroke="currentColor" stroke-width="1" />
      <!-- orbit ellipse, rotated -25° -->
      <g transform="rotate(-25 28 20)">
        <ellipse cx="28" cy="20" rx="26.98" ry="6.84" stroke="currentColor" stroke-width="1" opacity="0.55" />
      </g>
      <!-- accent dot, 4u diameter — the one amber/rust moment -->
      <circle cx="28" cy="20" r="2" fill="var(--almanac-accent, currentColor)" />
    </svg>
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue'

/**
 * OrbitalGlyph — the Almanac mark (inline SVG, viewBox 56×40).
 * The accent dot gets the amber glow in dark via --almanac-accent.
 * `size` is the rendered width; height is kept at the 40:56 ratio.
 */
const props = withDefaults(defineProps<{ size?: number | string }>(), {
  size: 56,
})

const size = computed(() => (typeof props.size === 'number' ? `${props.size}px` : props.size))
const glyphHeight = computed(() => {
  const w = typeof props.size === 'number' ? props.size : parseFloat(props.size) || 56
  return `${(w * 40) / 56}px`
})
</script>
