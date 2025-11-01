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
      class="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:max-w-md z-50 bg-gray-800 dark:bg-gray-900 rounded-lg shadow-2xl border border-gray-700 p-4"
    >
      <div class="flex items-start gap-3">
        <div class="flex-shrink-0">
          <svg class="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </div>
        <div class="flex-1 min-w-0">
          <p class="text-sm font-medium text-white">
            New version available
          </p>
          <p class="text-sm text-gray-400 mt-1">
            A new version of The Librarian is available. Reload to update.
          </p>
        </div>
        <button
          @click="close"
          class="flex-shrink-0 text-gray-400 hover:text-white transition-colors"
          aria-label="Close"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <div class="mt-4 flex gap-2">
        <button
          @click="update"
          class="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-md transition-colors"
        >
          Reload
        </button>
        <button
          @click="close"
          class="flex-1 bg-gray-700 hover:bg-gray-600 text-white text-sm font-medium px-4 py-2 rounded-md transition-colors"
        >
          Later
        </button>
      </div>
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
