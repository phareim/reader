<template>
  <component :is="as" class="mono-label inline-flex items-baseline">
    <span aria-hidden="true">—&nbsp;</span><slot />
  </component>
</template>

<script setup lang="ts">
/**
 * MonoLabel — the Almanac micro-label.
 * 9px tracked uppercase mono, accent color, leading em-dash, dark-mode glow.
 * The `.mono-label` utility carries all the type styling.
 */
withDefaults(defineProps<{ as?: string }>(), {
  as: 'span',
})
</script>
