<template>
  <Transition name="fade">
    <div
      v-if="isOpen"
      class="fixed inset-0 z-50 flex items-center justify-center p-almanac-gutter font-serif text-ink"
      style="background: var(--almanac-scrim, rgba(26,26,26,0.28));"
      @click.self="close"
    >
      <PaperPanel flush class="w-full max-w-2xl max-h-[80vh] overflow-y-auto">
        <!-- Header -->
        <div class="sticky top-0 z-10 bg-paper px-almanac-gutter pt-almanac-gutter pb-almanac-section-gap flex items-center justify-between">
          <div>
            <MonoLabel as="span">Reference</MonoLabel>
            <SerifHeadline level="h2" class="mt-1">Keyboard Shortcuts</SerifHeadline>
          </div>
          <button
            type="button"
            @click="close"
            class="text-mute hover:text-rust transition-colors"
            aria-label="Close"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div class="px-almanac-gutter"><SectionDivider /></div>

        <!-- Content -->
        <div class="px-almanac-gutter pb-almanac-gutter space-y-almanac-gutter">
          <!-- The Deck -->
          <section>
            <MonoLabel as="h3">The Deck</MonoLabel>
            <dl class="mt-2">
              <div v-for="row in deckRows" :key="row.label" class="flex items-center justify-between py-2 border-b border-rule">
                <dt class="text-[14px] text-ink leading-[1.55]">{{ row.label }}</dt>
                <dd class="flex items-center gap-2"><kbd v-for="k in row.keys" :key="k" class="kbd">{{ k }}</kbd></dd>
              </div>
            </dl>
          </section>

          <!-- Navigation -->
          <section>
            <MonoLabel as="h3">Navigation</MonoLabel>
            <dl class="mt-2">
              <div v-for="row in navRows" :key="row.label" class="flex items-center justify-between py-2 border-b border-rule">
                <dt class="text-[14px] text-ink leading-[1.55]">{{ row.label }}</dt>
                <dd class="flex items-center gap-2">
                  <template v-for="(k, i) in row.keys" :key="i">
                    <span v-if="k === 'or' || k === 'then' || k === '+'" class="text-[13px] text-mute italic">{{ k }}</span>
                    <kbd v-else class="kbd">{{ k }}</kbd>
                  </template>
                </dd>
              </div>
            </dl>
          </section>

          <!-- Article actions -->
          <section>
            <MonoLabel as="h3">Article Actions</MonoLabel>
            <dl class="mt-2">
              <div v-for="row in actionRows" :key="row.label" class="flex items-center justify-between py-2 border-b border-rule">
                <dt class="text-[14px] text-ink leading-[1.55]">{{ row.label }}</dt>
                <dd class="flex items-center gap-2">
                  <template v-for="(k, i) in row.keys" :key="i">
                    <span v-if="k === 'or' || k === '+'" class="text-[13px] text-mute italic">{{ k }}</span>
                    <kbd v-else class="kbd">{{ k }}</kbd>
                  </template>
                </dd>
              </div>
            </dl>
          </section>

          <!-- Touch gestures -->
          <section>
            <MonoLabel as="h3">Touch Gestures</MonoLabel>
            <dl class="mt-2">
              <div v-for="row in gestureRows" :key="row.label" class="flex items-center justify-between py-2 border-b border-rule">
                <dt class="text-[14px] text-ink leading-[1.55]">{{ row.label }}</dt>
                <dd class="text-[13px] text-mute italic">{{ row.gesture }}</dd>
              </div>
            </dl>
          </section>

          <p class="pt-2 text-[13px] text-mute italic text-center">
            Press <kbd class="kbd">Esc</kbd> or click outside to close.
          </p>
        </div>
      </PaperPanel>
    </div>
  </Transition>
</template>

<script setup lang="ts">
const isOpen = ref(false)

const deckRows = [
  { label: 'Store article (save for later)', keys: ['←'] },
  { label: 'Read article (mark as read)', keys: ['→'] },
  { label: 'Open article in reader', keys: ['↑'] },
  { label: 'Skip (send to back of deck)', keys: ['↓'] },
  { label: 'Undo last store / read', keys: ['u'] },
]

const navRows = [
  { label: 'Next article', keys: ['j', 'or', '↓'] },
  { label: 'Previous article', keys: ['k', 'or', '↑'] },
  { label: 'Go to overview (home)', keys: ['g', 'then', 'h'] },
  { label: 'Toggle menu', keys: ['m'] },
]

const actionRows = [
  { label: 'Open / close article', keys: ['o', 'or', 'Enter'] },
  { label: 'Mark as read', keys: ['e'] },
  { label: 'Mark all visible as read', keys: ['Shift', '+', 'a'] },
  { label: 'Save / unsave article', keys: ['s'] },
  { label: 'View original (new tab)', keys: ['v'] },
  { label: 'Show this help', keys: ['?'] },
]

const gestureRows = [
  { label: 'Store article', gesture: 'Swipe left ←' },
  { label: 'Read article', gesture: 'Swipe right →' },
  { label: 'Open in reader', gesture: 'Swipe up ↑' },
  { label: 'Skip', gesture: 'Swipe down ↓' },
]

const open = () => {
  isOpen.value = true
}

const close = () => {
  isOpen.value = false
}

// Close on Escape key
onMounted(() => {
  const handleEscape = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && isOpen.value) {
      close()
    }
  }
  window.addEventListener('keydown', handleEscape)

  onUnmounted(() => {
    window.removeEventListener('keydown', handleEscape)
  })
})

defineExpose({
  open,
  close,
  isOpen
})
</script>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* Hairline-framed key cap — no rounded box, no shadow. */
.kbd {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.6em;
  padding: 2px 6px;
  border: 1px solid var(--almanac-rule-line);
  font-family: var(--almanac-mono, "SF Mono", ui-monospace, monospace);
  font-size: 11px;
  letter-spacing: 0.04em;
  color: var(--almanac-fg);
  background: transparent;
}
</style>
