<template>
  <hr class="border-0 border-t border-rule" :class="strong ? 'border-rule-strong' : ''" />
</template>

<script setup lang="ts">
defineProps<{ strong?: boolean }>()
</script>
