<template>
  <Transition name="undo-toast">
    <div
      v-if="visible"
      class="fixed inset-x-0 bottom-6 z-30 flex justify-center px-4"
      role="status"
      aria-live="polite"
    >
      <PaperPanel flush class="flex items-center gap-4 px-almanac-gutter py-3">
        <span class="font-serif text-[14px] text-ink">{{ message }}</span>
        <ActionLabel label="UNDO" accent @click="emit('undo')" />
      </PaperPanel>
    </div>
  </Transition>
</template>

<script setup lang="ts">
/**
 * UndoToast — appears ~5s after a store/read commit. The single UNDO action
 * reverses the API call and restores the card. Auto-dismisses after `duration`.
 * Visibility + the dismiss timer are owned by the parent (CardStack); this is
 * a presentational shell driven by the `visible` prop.
 */
withDefaults(defineProps<{
  visible: boolean
  message?: string
}>(), {
  message: 'Done.',
})

const emit = defineEmits<{ (e: 'undo'): void }>()
</script>

<style scoped>
.undo-toast-enter-active,
.undo-toast-leave-active {
  transition: opacity 180ms ease, transform 180ms ease;
}
.undo-toast-enter-from,
.undo-toast-leave-to {
  opacity: 0;
  transform: translateY(8px);
}
</style>
