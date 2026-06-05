<template>
  <div class="bg-paper border border-rule" :class="paddingClass">
    <slot />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

/**
 * PaperPanel — a hairline-framed paper surface.
 * 1px border-rule, NO shadow, NO border-radius. The card stack and modals
 * compose this. `flush` removes the default gutter padding.
 */
const props = withDefaults(defineProps<{ flush?: boolean }>(), {
  flush: false,
})

const paddingClass = computed(() => (props.flush ? '' : 'p-almanac-gutter'))
</script>
