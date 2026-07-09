<template>
  <div class="flex flex-col items-center gap-6 text-center">
    <div class="text-4xl text-faint" aria-hidden="true">&#9789;</div>
    <!-- A brand-new account has no sources yet — "all caught up" would be
         a lie; point at the room where reading begins instead. -->
    <template v-if="noFeeds">
      <p class="max-w-xs text-lg italic text-mute">
        Nothing here yet. Add your first feed and the deck fills itself.
      </p>
      <ActionLabel accent @click="navigateTo('/sources')">Add a source</ActionLabel>
    </template>
    <template v-else>
      <p class="max-w-xs text-lg italic text-mute">
        All caught up. The next good thing will arrive on its own time.
      </p>
      <ActionLabel :disabled="syncing" @click="emit('sync')">
        {{ syncing ? 'Syncing…' : 'Sync all' }}
      </ActionLabel>
    </template>
  </div>
</template>

<script setup lang="ts">
defineProps<{ syncing?: boolean; noFeeds?: boolean }>()
const emit = defineEmits<{ sync: [] }>()
</script>
