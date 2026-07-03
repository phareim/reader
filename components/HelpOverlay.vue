<template>
  <Teleport to="body">
    <div v-if="open" class="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-5" @click.self="emit('close')">
      <CardFrame class="w-full max-w-sm p-6">
        <MonoLabel dash>Keys</MonoLabel>
        <table class="mt-4 w-full text-sm">
          <tbody>
            <tr v-for="row in keys" :key="row[0]" class="border-b border-rule last:border-0">
              <td class="py-1.5 pr-4 font-mono text-mute" style="font-size: 11px;">{{ row[0] }}</td>
              <td class="py-1.5 text-body">{{ row[1] }}</td>
            </tr>
          </tbody>
        </table>
        <div class="mt-5 text-right">
          <ActionLabel @click="emit('close')">Close</ActionLabel>
        </div>
      </CardFrame>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{ open: boolean; mode?: 'deck' | 'grid' }>(), {
  mode: 'deck',
})
const emit = defineEmits<{ close: [] }>()

const deckKeys = [
  ['←', 'Mark read'],
  ['→', 'Save to the shelf'],
  ['↑', 'Elevate to SFL'],
  ['↓', 'Skip — back of the deck'],
  ['o / Enter / tap', 'Open the reader'],
  ['u', 'Undo the last verb'],
  ['shift + r', 'Sync all feeds'],
  ['esc (reader)', 'Back'],
  ['s / e / v (reader)', 'Save · Elevate · Original'],
  ['h (reader)', 'Highlight selection'],
  ['?', 'This card'],
]

// Grid mode has no arrow verbs — vertical belongs to scrolling, elevate is
// deck-only, and swipes are horizontal per card.
const gridKeys = [
  ['swipe ←', 'Mark read'],
  ['swipe →', 'Save to the shelf'],
  ['tap', 'Open the reader'],
  ['u', 'Undo the last verb'],
  ['shift + r', 'Sync all feeds'],
  ['esc (reader)', 'Back'],
  ['s / e / v (reader)', 'Save · Elevate · Original'],
  ['h (reader)', 'Highlight selection'],
  ['?', 'This card'],
]

const keys = computed(() => (props.mode === 'grid' ? gridKeys : deckKeys))
</script>
