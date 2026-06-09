<script setup lang="ts">
import { useRegisterSW } from 'virtual:pwa-register/vue'

const {
  needRefresh,
  updateServiceWorker,
} = useRegisterSW()

const close = () => {
  needRefresh.value = false
}

const update = async () => {
  await updateServiceWorker()
}
</script>

<template>
  <Transition name="slide-up">
    <div
      v-if="needRefresh"
      class="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:max-w-md z-50 font-serif text-ink"
    >
      <CardFrame class="p-4">
        <div class="flex items-start justify-between gap-3.5">
          <div class="flex-1 min-w-0">
            <MonoLabel>Update</MonoLabel>
            <p class="text-[14px] text-ink leading-[1.55] mt-1">
              A new version of The Reader is available.
            </p>
          </div>
          <button
            type="button"
            @click="close"
            class="flex-shrink-0 text-mute hover:text-ink transition-colors"
            aria-label="Close"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div class="mt-3.5 flex items-center gap-3.5">
          <ActionLabel accent @click="update">Reload</ActionLabel>
          <ActionLabel @click="close">Later</ActionLabel>
        </div>
      </CardFrame>
    </div>
  </Transition>
</template>

<style scoped>
.slide-up-enter-active,
.slide-up-leave-active {
  transition: all 0.3s ease;
}

.slide-up-enter-from {
  transform: translateY(100%);
  opacity: 0;
}

.slide-up-leave-to {
  transform: translateY(100%);
  opacity: 0;
}
</style>
