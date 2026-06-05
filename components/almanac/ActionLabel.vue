<template>
  <button
    type="button"
    class="group inline-flex items-baseline border border-rule bg-transparent px-3 py-2 transition-colors duration-150"
    :class="[
      accent ? 'border-rust' : 'hover:border-ink/40',
      disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer',
    ]"
    :disabled="disabled"
    :aria-label="label"
    @click="onClick"
  >
    <span
      class="mono-label inline-flex items-baseline"
      :style="accent ? undefined : { color: 'var(--almanac-fg-mute)', textShadow: 'none' }"
    >
      <span aria-hidden="true">—&nbsp;</span>{{ label }}
    </span>
  </button>
</template>

<script setup lang="ts">
/**
 * ActionLabel — the Almanac substitute for a button.
 * A MonoLabel inside a hairline border. NEVER rounded, NEVER shadowed.
 * Non-accent labels render in mute (so the one accent moment is reserved);
 * `accent` promotes the label + border to rust/amber.
 */
const props = withDefaults(defineProps<{
  label: string
  accent?: boolean
  disabled?: boolean
}>(), {
  accent: false,
  disabled: false,
})

const emit = defineEmits<{ (e: 'click', ev: MouseEvent): void }>()

function onClick(ev: MouseEvent) {
  if (props.disabled) return
  emit('click', ev)
}
</script>
