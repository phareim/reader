<template>
  <div ref="containerRef" class="relative font-serif">
    <input
      ref="inputRef"
      v-model="inputValue"
      type="text"
      :placeholder="placeholder"
      class="tag-input"
      @input="handleInput"
      @keydown="handleKeydown"
      @focus="handleFocus"
    />

    <!-- Autocomplete Dropdown -->
    <Transition name="dropdown">
      <div
        v-if="showSuggestions && filteredSuggestions.length > 0"
        class="absolute z-50 w-full mt-1 bg-paper border border-rule max-h-48 overflow-y-auto"
      >
        <button
          v-for="(suggestion, index) in filteredSuggestions"
          :key="suggestion"
          type="button"
          @mousedown.prevent="selectSuggestion(suggestion)"
          class="w-full text-left px-3 py-2 text-[13px] transition-colors flex items-center justify-between hover:text-rust"
          :class="index === selectedIndex ? 'text-rust' : 'text-ink'"
        >
          <span>#{{ suggestion }}</span>
          <span class="text-[11px] text-mute italic">
            {{ getTagUsageCount(suggestion) }}
          </span>
        </button>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
interface Props {
  placeholder?: string
  existingTags?: string[]
  allTags?: Array<{ name: string; feedCount: number; savedArticleCount: number }>
}

const props = withDefaults(defineProps<Props>(), {
  placeholder: 'Add tag...',
  existingTags: () => [],
  allTags: () => []
})

const emit = defineEmits<{
  'add-tag': [tag: string]
}>()

const inputRef = ref<HTMLInputElement | null>(null)
const inputValue = ref('')
const showSuggestions = ref(false)
const selectedIndex = ref(0)

// Close dropdown when clicking outside
const containerRef = useClickOutside(() => {
  showSuggestions.value = false
})

// Filter suggestions based on input
const filteredSuggestions = computed(() => {
  const input = inputValue.value.trim().toLowerCase()

  // Don't show suggestions if input is too short
  if (input.length < 3) {
    return []
  }

  // Filter tags that match input and aren't already added
  return props.allTags
    .map(t => t.name)
    .filter(tag =>
      !props.existingTags.includes(tag) &&
      tag.toLowerCase().includes(input)
    )
    .slice(0, 10) // Limit to 10 suggestions
})

const getTagUsageCount = (tagName: string) => {
  const tag = props.allTags.find(t => t.name === tagName)
  if (!tag) return ''
  const total = tag.feedCount + tag.savedArticleCount
  return total > 0 ? `${total} ${total === 1 ? 'use' : 'uses'}` : ''
}

const handleInput = () => {
  showSuggestions.value = true
  selectedIndex.value = 0
}

const handleFocus = () => {
  if (inputValue.value.length >= 3) {
    showSuggestions.value = true
  }
}

const handleKeydown = (e: KeyboardEvent) => {
  if (!showSuggestions.value || filteredSuggestions.value.length === 0) {
    // Enter key without suggestions - add new tag
    if (e.key === 'Enter') {
      e.preventDefault()
      addTag()
    }
    return
  }

  // Navigate suggestions
  switch (e.key) {
    case 'ArrowDown':
      e.preventDefault()
      selectedIndex.value = Math.min(
        selectedIndex.value + 1,
        filteredSuggestions.value.length - 1
      )
      break
    case 'ArrowUp':
      e.preventDefault()
      selectedIndex.value = Math.max(selectedIndex.value - 1, 0)
      break
    case 'Enter':
      e.preventDefault()
      if (filteredSuggestions.value[selectedIndex.value]) {
        selectSuggestion(filteredSuggestions.value[selectedIndex.value])
      } else {
        addTag()
      }
      break
    case 'Escape':
      e.preventDefault()
      showSuggestions.value = false
      break
  }
}

const selectSuggestion = (tag: string) => {
  inputValue.value = ''
  showSuggestions.value = false
  selectedIndex.value = 0
  emit('add-tag', tag)
  inputRef.value?.focus()
}

const addTag = () => {
  const tag = inputValue.value.trim()
  if (tag && !props.existingTags.includes(tag)) {
    inputValue.value = ''
    showSuggestions.value = false
    selectedIndex.value = 0
    emit('add-tag', tag)
  }
}

// Expose focus method for parent component
defineExpose({
  focus: () => inputRef.value?.focus()
})
</script>

<style scoped>
/* Hairline-underlined input — no box, no radius, no shadow. */
.tag-input {
  width: 100%;
  background: transparent;
  border: 0;
  border-bottom: 1px solid var(--almanac-rule-line);
  color: var(--almanac-fg);
  font-family: var(--almanac-serif, "Source Serif 4", Georgia, serif);
  font-size: 13px;
  padding: 4px 0;
  outline: none;
  transition: border-color 0.15s ease;
}
.tag-input::placeholder {
  color: var(--almanac-fg-mute);
  opacity: 0.7;
}
.tag-input:focus {
  border-bottom-color: var(--almanac-accent);
}

/* Dropdown transition */
.dropdown-enter-active,
.dropdown-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.dropdown-enter-from,
.dropdown-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

.dropdown-enter-to,
.dropdown-leave-from {
  opacity: 1;
  transform: translateY(0);
}
</style>
