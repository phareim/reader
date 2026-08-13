<template>
  <Teleport to="body">
    <div v-if="open" class="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-5" @click.self="emit('close')">
      <!-- The table outgrew a short screen once the reader keys joined it, and
           CardFrame clips its overflow — let the list scroll inside the card
           rather than lose its last rows off the bottom edge. -->
      <CardFrame class="flex max-h-[85dvh] w-full max-w-sm flex-col p-6">
        <MonoLabel dash>Keys</MonoLabel>
        <div class="mt-4 min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <table class="w-full text-sm">
            <tbody>
              <tr v-for="row in keys" :key="row[0]" class="border-b border-rule last:border-0">
                <td class="py-1.5 pr-4 font-mono text-mute" style="font-size: 11px;">{{ row[0] }}</td>
                <td class="py-1.5 text-body">{{ row[1] }}</td>
              </tr>
            </tbody>
          </table>
        </div>
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

// The reader's own keys, shared by both tables. Kept in one place so a key
// added to pages/article/[id].vue can't go on being undiscoverable in half
// the card (r, g, w and l all shipped without ever reaching this list).
const readerKeys = [
  ['esc (reader)', 'Back'],
  ['r / x / e (reader)', 'Mark read, on to the next'],
  ['j / k (reader)', 'Next · previous unread'],
  ['s (reader)', 'Save'],
  ['o / v (reader)', 'Open the original'],
  ['shift + e (reader)', 'Elevate to SFL'],
  ['h (reader)', 'Highlight selection'],
  ['g (reader)', 'Mark a good read'],
  ['w / l (reader)', 'Speed-read · Read aloud'],
]

const deckKeys = [
  ['← / x / e', 'Mark read'],
  ['→', 'Save to the shelf'],
  ['↑', 'Elevate to SFL'],
  ['↓ / j', 'Skip — back of the deck'],
  ['k', 'Bring the previous card back'],
  ['o / Enter / tap', 'Open the reader'],
  ['u', 'Undo the last verb'],
  ['shift + r', 'Sync all feeds'],
  ['/', 'Search'],
  ['⌘ shift p / ⌘ k', 'Command palette'],
  ...readerKeys,
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
  ['/', 'Search'],
  ['⌘ shift p / ⌘ k', 'Command palette'],
  ...readerKeys,
  ['?', 'This card'],
]

const keys = computed(() => (props.mode === 'grid' ? gridKeys : deckKeys))
</script>
