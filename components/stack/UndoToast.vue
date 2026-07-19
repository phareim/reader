<template>
  <Transition name="undo">
    <div
      v-if="visible"
      class="fixed left-1/2 z-50 -translate-x-1/2"
      style="bottom: calc(4.5rem + env(safe-area-inset-bottom));"
    >
      <ActionLabel accent @click="emit('undo')">Undo {{ label }}</ActionLabel>
    </div>
  </Transition>
</template>

<script setup lang="ts">
defineProps<{ visible: boolean; label: string }>()
const emit = defineEmits<{ undo: [] }>()
</script>

<style scoped>
.undo-enter-active, .undo-leave-active { transition: opacity .2s ease; }
.undo-enter-from, .undo-leave-to { opacity: 0; }
</style>
