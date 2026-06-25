<template>
  <Teleport to="body">
    <div class="fixed inset-0 z-50" @click.self="emit('close')">
      <div class="absolute w-[18rem] max-w-[calc(100vw-2rem)]" :style="posStyle">
        <CardFrame class="p-4">
          <div class="flex items-center justify-between">
            <MonoLabel dash>Note</MonoLabel>
            <MonoLabel v-if="highlight.sflIdeaId" accent>In SFL</MonoLabel>
          </div>
          <HairlineRule class="mt-3 mb-3" />

          <p v-if="highlight.note" class="note-body text-body" v-html="noteHtml" />
          <p v-else class="italic text-mute">No note</p>

          <div class="mt-4 flex justify-end gap-3">
            <ActionLabel @click="emit('remove')">Remove</ActionLabel>
            <ActionLabel @click="emit('close')">Close</ActionLabel>
          </div>
        </CardFrame>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { renderNoteHtml } from '~/utils/hashtags'
import type { Highlight } from '~/composables/useHighlights'

const props = defineProps<{ highlight: Highlight; x: number; y: number }>()
const emit = defineEmits<{ remove: []; close: [] }>()

const noteHtml = computed(() => renderNoteHtml(props.highlight.note))

// Clamp the popover into the viewport near the tapped mark.
const posStyle = computed(() => {
  const margin = 16
  const width = 288 // 18rem
  const maxLeft = (typeof window !== 'undefined' ? window.innerWidth : width + 2 * margin) - width - margin
  const left = Math.max(margin, Math.min(props.x, maxLeft))
  return { left: `${left}px`, top: `${props.y + 12}px` }
})
</script>

<style scoped>
.note-body :deep(.note-tag) {
  color: var(--text-accent);
  font-style: italic;
}
</style>
