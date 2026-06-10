<template>
  <Teleport to="body">
    <div class="fixed inset-0 z-50 overflow-y-auto bg-paper" role="dialog" aria-modal="true" aria-label="Edit tags">
      <div class="mx-auto max-w-measure px-5 py-6">
        <header class="flex items-baseline justify-between gap-3">
          <MonoLabel dash>Tags</MonoLabel>
          <span class="min-w-0 truncate text-lg text-ink">{{ feed.title }}</span>
        </header>
        <HairlineRule class="mt-3 mb-5" />

        <div v-if="draft.length" class="flex flex-wrap gap-2">
          <button
            v-for="tag in draft"
            :key="tag"
            type="button"
            class="tag-chip"
            :aria-label="`Remove tag ${tag}`"
            @click="removeTag(tag)"
          >{{ tag }}&nbsp;&times;</button>
        </div>
        <MonoLabel v-else>No tags</MonoLabel>

        <input
          ref="inputEl"
          v-model="query"
          type="text"
          placeholder="Type to add or filter…"
          aria-autocomplete="list"
          class="mt-5 w-full border-0 border-b border-rule bg-transparent py-1.5 text-ink outline-none focus:border-accent"
          @keydown="onInputKey"
        />

        <ul v-if="suggestions.length" class="mt-2">
          <li v-for="(tag, i) in suggestions" :key="tag" class="border-b border-rule last:border-0">
            <button
              type="button"
              class="suggestion w-full py-2 text-left"
              :class="i === highlight ? 'text-ink' : 'text-mute hover:text-ink'"
              @click="addTag(tag)"
            ><template v-if="i === highlight">&mdash;&nbsp;</template>{{ tag }}</button>
          </li>
        </ul>

        <HairlineRule class="mt-8" />
        <div class="mt-4 flex justify-end gap-3">
          <ActionLabel @click="emit('close')">Cancel</ActionLabel>
          <ActionLabel accent @click="emit('save', [...draft])">Save</ActionLabel>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import type { Feed } from '~/types'

const props = defineProps<{ feed: Feed; allTags: string[] }>()
const emit = defineEmits<{ close: []; save: [tags: string[]] }>()

const draft = ref<string[]>([...props.feed.tags])
const query = ref('')
const highlight = ref(-1)
const inputEl = ref<HTMLInputElement | null>(null)

const suggestions = computed(() => {
  const q = query.value.trim().toLowerCase()
  const selected = new Set(draft.value.map((t) => t.toLowerCase()))
  return props.allTags
    .filter((t) => !selected.has(t.toLowerCase()))
    .filter((t) => !q || t.toLowerCase().includes(q))
})

watch(query, () => { highlight.value = -1 })

function addTag(raw: string) {
  const tag = raw.trim()
  if (!tag) return
  if (!draft.value.some((t) => t.toLowerCase() === tag.toLowerCase())) {
    draft.value = [...draft.value, tag]
  }
  query.value = ''
  highlight.value = -1
}

function removeTag(tag: string) {
  draft.value = draft.value.filter((t) => t !== tag)
}

function onInputKey(e: KeyboardEvent) {
  if (e.key === 'Enter') {
    e.preventDefault()
    if (highlight.value >= 0 && suggestions.value[highlight.value]) {
      addTag(suggestions.value[highlight.value])
    } else {
      addTag(query.value)
    }
  } else if (e.key === ',') {
    e.preventDefault()
    addTag(query.value)
  } else if (e.key === 'ArrowDown') {
    e.preventDefault()
    const len = suggestions.value.length
    if (len) highlight.value = (highlight.value + 1) % len
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    const len = suggestions.value.length
    if (len) highlight.value = (highlight.value - 1 + len) % len
  } else if (e.key === 'Backspace' && query.value === '' && draft.value.length) {
    removeTag(draft.value[draft.value.length - 1])
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
.tag-chip,
.suggestion {
  font-family: 'SF Mono', ui-monospace, Menlo, monospace;
  font-size: 10px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  border-radius: 0;
}
.tag-chip {
  border: 1px solid var(--border-rule);
  color: var(--text-strong);
  padding: 4px 8px;
}
.tag-chip:hover { border-color: var(--border-strong); }
.tag-chip:focus-visible,
.suggestion:focus-visible { outline: 1px solid var(--tufte-accent); }
</style>
