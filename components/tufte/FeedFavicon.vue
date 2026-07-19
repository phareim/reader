<template>
  <img
    v-if="src && !failed"
    :src="src"
    alt=""
    aria-hidden="true"
    class="feed-favicon"
    :style="{ width: `${size}px`, height: `${size}px` }"
    loading="lazy"
    draggable="false"
    @error="failed = true"
  />
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'

/**
 * A feed's tiny favicon (Feed.favicon_url — Google S2, 32px source).
 * Quiet visual differentiation beside a feed name. Renders nothing when
 * there is no URL or the image fails to load — the text label always
 * stands on its own.
 */
const props = withDefaults(defineProps<{
  src?: string | null
  /** Square size in px. */
  size?: number
}>(), { size: 12 })

const failed = ref(false)
watch(() => props.src, () => { failed.value = false })
</script>

<style scoped>
.feed-favicon {
  display: inline-block;
  vertical-align: -0.15em;
  flex-shrink: 0;
  /* Sit calmly on the paper, matching the card images' muted saturation */
  filter: saturate(.85);
}
</style>
