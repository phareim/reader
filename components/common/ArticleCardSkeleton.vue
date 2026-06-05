<template>
  <!-- Hairline reading-column row skeleton — shimmer in mute, no boxes/radius -->
  <div class="py-almanac-section-gap animate-pulse">
    <!-- Source label line -->
    <div class="h-2 w-24 bg-rule mb-3"></div>
    <!-- Title lines -->
    <div class="space-y-2 mb-3">
      <div class="h-4 bg-rule w-11/12"></div>
      <div class="h-4 bg-rule w-2/3"></div>
    </div>
    <!-- Excerpt lines -->
    <div class="space-y-2">
      <div class="h-3 bg-rule/60 w-full"></div>
      <div class="h-3 bg-rule/60 w-5/6"></div>
    </div>
  </div>
</template>

<script setup lang="ts">
// Pure visual component — Almanac hairline shimmer, no logic needed.
</script>
