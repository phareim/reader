<template>
  <div class="flex flex-col items-center gap-6 text-center">
    <div class="text-4xl text-faint" aria-hidden="true">&#9789;</div>
    <p class="max-w-xs text-lg italic text-mute">
      All caught up. The next good thing will arrive on its own time.
    </p>
    <ActionLabel :disabled="syncing" @click="emit('sync')">
      {{ syncing ? 'Syncing…' : 'Sync all' }}
    </ActionLabel>
  </div>
</template>

<script setup lang="ts">
defineProps<{ syncing?: boolean }>()
const emit = defineEmits<{ sync: [] }>()
</script>
