<template>
  <button
    type="button"
    class="border px-3 py-1.5 font-mono uppercase transition-colors duration-150 select-none"
    :class="accent
      ? 'border-accent text-accent-ink'
      : 'border-rule text-mute hover:border-rule-strong hover:text-ink'"
    style="font-size: 10px; letter-spacing: 0.16em; border-radius: 0;"
    :disabled="disabled"
    @click="emit('click')"
  >&mdash;&nbsp;<slot /></button>
</template>

<script setup lang="ts">
defineProps<{ accent?: boolean; disabled?: boolean }>()
const emit = defineEmits<{ click: [] }>()
</script>
