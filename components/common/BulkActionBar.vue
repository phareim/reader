<template>
  <Transition name="slide-up">
    <div
      v-if="selectedCount > 0"
      class="fixed bottom-0 left-0 right-0 z-30 bg-paper border-t border-rule py-almanac-section-gap px-almanac-gutter font-serif text-ink"
    >
      <div class="flex items-center justify-between max-w-almanac-measure mx-auto gap-almanac-gutter">
        <div class="flex items-center gap-almanac-section-gap">
          <MonoLabel as="span">{{ selectedCount }} selected</MonoLabel>
          <button
            type="button"
            @click="$emit('clear')"
            class="text-[13px] text-mute italic hover:text-rust transition-colors"
          >
            Clear
          </button>
        </div>

        <div class="flex items-center gap-almanac-section-gap">
          <ActionLabel label="MARK READ" accent @click="$emit('mark-read')" />
          <ActionLabel label="SAVE" @click="$emit('save')" />
          <ActionLabel label="EXIT" @click="$emit('exit')" />
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
interface Props {
  selectedCount: number
}

defineProps<Props>()

defineEmits<{
  'mark-read': []
  'save': []
  'clear': []
  'exit': []
}>()
</script>

<style scoped>
.slide-up-enter-active,
.slide-up-leave-active {
  transition: transform 0.3s ease, opacity 0.3s ease;
}

.slide-up-enter-from,
.slide-up-leave-to {
  transform: translateY(100%);
  opacity: 0;
}

.slide-up-enter-to,
.slide-up-leave-from {
  transform: translateY(0);
  opacity: 1;
}
</style>
