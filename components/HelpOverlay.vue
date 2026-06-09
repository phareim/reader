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
defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: [] }>()

const keys = [
  ['←', 'Save to the shelf'],
  ['→', 'Mark read'],
  ['↑', 'Elevate to SFL'],
  ['↓', 'Skip — back of the deck'],
  ['o / Enter / tap', 'Open the reader'],
  ['u', 'Undo the last verb'],
  ['shift + r', 'Sync all feeds'],
  ['esc (reader)', 'Back'],
  ['s / e / v (reader)', 'Save · Elevate · Original'],
  ['?', 'This card'],
]
</script>
