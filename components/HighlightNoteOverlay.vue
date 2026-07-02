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

        <!-- Live-marked note input: the textarea's own text is transparent and a
             mirror div underneath renders the draft with #hashtags accented, so
             tags light up as you type while caret/selection stay native. -->
        <div class="relative mt-5">
          <div
            ref="mirrorEl"
            aria-hidden="true"
            class="note-mirror pointer-events-none absolute inset-0 overflow-hidden whitespace-pre-wrap break-words py-1.5 text-ink"
            v-html="draftHtml"
          />
          <textarea
            ref="inputEl"
            v-model="draft"
            rows="3"
            placeholder="A note — use #tags to file it in SFL…"
            class="note-input relative w-full resize-none border-0 border-b border-rule bg-transparent py-1.5 text-transparent placeholder:text-mute outline-none focus:border-accent"
            @keydown="onKey"
            @scroll="syncScroll"
          />
        </div>

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
import { computed, watch, nextTick } from 'vue'
import { renderNoteHtml } from '~/utils/hashtags'

const props = defineProps<{ quote: string; saving?: boolean }>()
const emit = defineEmits<{ close: []; save: [note: string] }>()

const draft = ref('')
const inputEl = ref<HTMLTextAreaElement | null>(null)
const mirrorEl = ref<HTMLElement | null>(null)

// Trailing zero-width space keeps a trailing newline occupying a line, so the
// mirror's scroll height stays in step with the textarea's.
const draftHtml = computed(() => renderNoteHtml(draft.value) + '\u200B')

function syncScroll() {
  if (mirrorEl.value && inputEl.value) mirrorEl.value.scrollTop = inputEl.value.scrollTop
}
watch(draft, () => nextTick(syncScroll))

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

<style scoped>
.note-input {
  caret-color: var(--text-ink);
}
/* The textarea's glyphs are transparent — keep the selection translucent so
   the mirror's text stays readable underneath it. */
.note-input::selection {
  background: color-mix(in srgb, var(--text-accent) 20%, transparent);
}
.note-mirror :deep(.note-tag) {
  color: var(--text-accent);
  /* Fake bold: a real font-weight change would alter glyph widths and drift
     the (transparent) textarea's caret out of alignment with the mirror. */
  text-shadow: 0 0 0.8px currentColor, 0 0 0.8px currentColor;
}
</style>
