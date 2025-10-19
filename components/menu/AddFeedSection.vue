<template>
  <FeedUrlInput @success="emit('success', $event)" @error="emit('error', $event)" />
</template>

<script setup lang="ts">
const emit = defineEmits(['success', 'error'])
</script>
