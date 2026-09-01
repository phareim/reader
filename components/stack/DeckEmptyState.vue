<template>
  <!-- The deck's last sheet: blank paper with the one accent stamped on it.
       A stamp is the tactile layer's single sanctioned use of red ink on a
       page; it replaces the old moon glyph. -->
  <div class="tufte-sheet flex h-full w-full flex-col items-center justify-center gap-6 px-8 text-center">
    <span class="tufte-stamp" aria-hidden="true">{{ noFeeds ? 'No sources' : 'Caught up' }}</span>
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
    </template>
  </div>
</template>

<script setup lang="ts">
defineProps<{ noFeeds?: boolean }>()
</script>
