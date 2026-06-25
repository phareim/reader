<template>
  <Teleport to="body">
    <div class="fixed inset-0 z-50 overflow-y-auto bg-paper" role="dialog" aria-modal="true" aria-label="Add a note">
      <div class="mx-auto max-w-measure px-5 py-6">
        <header class="flex items-baseline justify-between gap-3">
          <MonoLabel dash>Highlight</MonoLabel>
          <MonoLabel>Optional note</MonoLabel>
        </header>
        <HairlineRule class="mt-3 mb-5" />

        <blockquote class="border-l-2 border-accent pl-4 text-lg italic text-ink">
          {{ quote }}
        </blockquote>

        <textarea
          ref="inputEl"
          v-model="draft"
          rows="3"
          placeholder="A note — use #tags to file it in SFL…"
          class="mt-5 w-full resize-none border-0 border-b border-rule bg-transparent py-1.5 text-ink outline-none focus:border-accent"
          @keydown="onKey"
        />

        <HairlineRule class="mt-8" />
        <div class="mt-4 flex justify-end gap-3">
          <ActionLabel :disabled="saving" @click="emit('close')">Cancel</ActionLabel>
          <ActionLabel accent :disabled="saving" @click="save">{{ saving ? 'Saving…' : 'Save' }}</ActionLabel>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
const props = defineProps<{ quote: string; saving?: boolean }>()
const emit = defineEmits<{ close: []; save: [note: string] }>()

const draft = ref('')
const inputEl = ref<HTMLTextAreaElement | null>(null)

function save() {
  if (props.saving) return
  emit('save', draft.value.trim())
}

function onKey(e: KeyboardEvent) {
  // Cmd/Ctrl+Enter commits; Esc cancels. Plain Enter adds newlines to the note.
  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
    e.preventDefault()
    save()
  } else if (e.key === 'Escape') {
    e.preventDefault()
    emit('close')
  }
}

function onWindowKey(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    e.preventDefault()
    emit('close')
  }
}

onMounted(() => {
  window.addEventListener('keydown', onWindowKey)
  inputEl.value?.focus()
})
onUnmounted(() => window.removeEventListener('keydown', onWindowKey))
</script>
