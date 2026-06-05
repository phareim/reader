<template>
  <div class="flex flex-col items-center justify-center px-6 py-24 text-center">
    <OrbitalGlyph :size="72" />

    <p class="mt-8 font-serif text-[21px] leading-[1.22] text-ink">
      You're all caught up.
    </p>

    <p class="mt-2 font-serif text-[14px] italic text-mute">
      Nothing left unread in this view.
    </p>

    <div class="mt-8">
      <ActionLabel
        label="SYNC ALL"
        accent
        :disabled="syncing"
        @click="emit('sync-all')"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * DeckEmptyState — shown when the reading deck is empty.
 * Centered OrbitalGlyph + "You're all caught up." + a single rust SYNC ALL action.
 */
defineProps<{ syncing?: boolean }>()

const emit = defineEmits<{ (e: 'sync-all'): void }>()
</script>
