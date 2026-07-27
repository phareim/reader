<template>
  <!--
    Every failure in the app reports through here ("Sync failed", "Save
    failed", "Undo could not reach the server"). Without a live region a
    screen reader never hears any of it — the toast appears and leaves again
    in silence.

    The region is a separate always-mounted element rather than a role on the
    toast itself: a live region that is inserted at the same moment as its
    text is announced unreliably. This one is in the DOM from first paint, so
    the message lands in an already-observed node. Errors interrupt (assertive),
    successes wait their turn (polite).
  -->
  <div class="sr-only" role="status" aria-live="polite">{{ success || '' }}</div>
  <div class="sr-only" role="alert" aria-live="assertive">{{ error || '' }}</div>

  <Transition name="toast">
    <div
      v-if="success || error"
      aria-hidden="true"
      class="fixed left-1/2 -translate-x-1/2 z-50 border bg-paper-raised px-4 py-2"
      :class="error ? 'border-accent' : 'border-rule-strong'"
      style="bottom: calc(4.5rem + env(safe-area-inset-bottom));"
    >
      <MonoLabel :accent="!!error" dash>{{ success || error }}</MonoLabel>
    </div>
  </Transition>
</template>

<script setup lang="ts">
const { success, error } = useToast()
</script>

<style scoped>
.toast-enter-active, .toast-leave-active { transition: opacity .2s ease, transform .2s ease; }
.toast-enter-from, .toast-leave-to { opacity: 0; transform: translate(-50%, 6px); }
</style>
