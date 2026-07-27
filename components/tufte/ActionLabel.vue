<template>
  <button
    type="button"
    class="action-label border font-mono uppercase transition-colors duration-150 select-none disabled:opacity-40 disabled:cursor-not-allowed"
    :class="[
      accent
        ? 'border-accent text-accent-ink'
        : 'border-rule text-mute hover:border-rule-strong hover:text-ink',
      $slots.icon ? 'px-2.5 py-1.5 sm:px-3' : 'px-3 py-1.5',
    ]"
    style="font-size: 10px; letter-spacing: 0.16em; border-radius: 0;"
    :disabled="disabled"
    @click="emit('click')"
  ><!-- With an icon slot, the glyph carries the button on narrow screens and
       the text label takes over from sm: up. A `compact` slot puts a short
       text beside the glyph on those narrow screens (e.g. a checkmark +
       "Read" standing in for "Mark as read"). Without an icon, text label
       always. -->
    <span v-if="$slots.icon" class="flex items-center justify-center gap-1 sm:hidden" aria-hidden="true"><slot name="icon" /><span v-if="$slots.compact"><slot name="compact" /></span></span>
    <span :class="$slots.icon ? 'hidden sm:inline' : undefined">&mdash;&nbsp;<slot /></span>
  </button>
</template>

<script setup lang="ts">
defineProps<{ accent?: boolean; disabled?: boolean }>()
const emit = defineEmits<{ click: [] }>()
</script>

<style scoped>
/* The one button in the system that lacked the focus ring components/CLAUDE.md
   asks every mono-label button to carry — and the one a keyboard reaches most
   (Sync all, Add, Mark as read, Undo). */
.action-label:focus-visible {
  outline: 1px solid var(--tufte-accent);
  outline-offset: 2px;
}

/* The bordered box is ~26px tall; a thumb wants 40. The pad grows the
   pressable area vertically only — the reader's action row sets its buttons
   6px apart, so any horizontal growth would make neighbouring hit areas
   overlap and "Save" would swallow taps meant for "Elevate". */
.action-label {
  position: relative;
}
.action-label::after {
  content: '';
  position: absolute;
  inset: -7px 0;
}
</style>
