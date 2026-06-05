<template>
  <component :is="tag" :class="['font-serif font-medium text-ink m-0', sizeClass]" :style="style">
    <slot />
  </component>
</template>

<script setup lang="ts">
import { computed } from 'vue'

/**
 * SerifHeadline — 26px serif headline (line 1.20, tracking -0.012em).
 * `level` scales the size: h1 = 26px, h2 = 21px, h3 = 18px.
 */
const props = withDefaults(defineProps<{ level?: 'h1' | 'h2' | 'h3' }>(), {
  level: 'h1',
})

const tag = computed(() => props.level)

const sizeClass = computed(() => {
  switch (props.level) {
    case 'h2':
      return 'text-[21px] leading-[1.22]'
    case 'h3':
      return 'text-[18px] leading-[1.28]'
    default:
      return 'text-[26px] leading-[1.2]'
  }
})

const style = { letterSpacing: '-0.012em' } as const
</script>
