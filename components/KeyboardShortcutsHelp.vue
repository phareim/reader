<template>
  <Transition name="fade">
    <div
      v-if="isOpen"
      class="fixed inset-0 bg-black bg-opacity-50 dark:bg-opacity-70 z-50 flex items-center justify-center p-4"
      @click.self="close"
    >
      <div class="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
        <!-- Header -->
        <div class="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between">
          <h2 class="text-2xl font-bold text-gray-900 dark:text-gray-100">Keyboard Shortcuts</h2>
          <button
            @click="close"
            class="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            aria-label="Close"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <!-- Content -->
        <div class="p-6 space-y-6">
          <!-- Navigation -->
          <div>
            <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">Navigation</h3>
            <div class="space-y-2">
              <div class="flex items-center justify-between py-2 border-b border-gray-200 dark:border-gray-700">
                <span class="text-gray-700 dark:text-gray-300">Next article</span>
                <div class="flex gap-2">
                  <kbd class="px-3 py-1 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-sm font-mono text-gray-900 dark:text-gray-100">j</kbd>
                  <span class="text-gray-400 dark:text-gray-500">or</span>
                  <kbd class="px-3 py-1 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-sm font-mono text-gray-900 dark:text-gray-100">↓</kbd>
                </div>
              </div>
              <div class="flex items-center justify-between py-2 border-b border-gray-200 dark:border-gray-700">
                <span class="text-gray-700 dark:text-gray-300">Previous article</span>
                <div class="flex gap-2">
                  <kbd class="px-3 py-1 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-sm font-mono text-gray-900 dark:text-gray-100">k</kbd>
                  <span class="text-gray-400 dark:text-gray-500">or</span>
                  <kbd class="px-3 py-1 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-sm font-mono text-gray-900 dark:text-gray-100">↑</kbd>
                </div>
              </div>
              <div class="flex items-center justify-between py-2 border-b border-gray-200 dark:border-gray-700">
                <span class="text-gray-700 dark:text-gray-300">Go to all feeds</span>
                <kbd class="px-3 py-1 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-sm font-mono text-gray-900 dark:text-gray-100">g</kbd>
                <span class="text-gray-400 dark:text-gray-500 mx-2">then</span>
                <kbd class="px-3 py-1 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-sm font-mono text-gray-900 dark:text-gray-100">i</kbd>
              </div>
              <div class="flex items-center justify-between py-2 border-b border-gray-200 dark:border-gray-700">
                <span class="text-gray-700 dark:text-gray-300">Go to all articles</span>
                <kbd class="px-3 py-1 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-sm font-mono text-gray-900 dark:text-gray-100">g</kbd>
                <span class="text-gray-400 dark:text-gray-500 mx-2">then</span>
                <kbd class="px-3 py-1 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-sm font-mono text-gray-900 dark:text-gray-100">a</kbd>
              </div>
            </div>
          </div>

          <!-- Menu & Navigation -->
          <div>
            <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">Menu</h3>
            <div class="space-y-2">
              <div class="flex items-center justify-between py-2 border-b border-gray-200 dark:border-gray-700">
                <span class="text-gray-700 dark:text-gray-300">Toggle menu</span>
                <kbd class="px-3 py-1 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-sm font-mono text-gray-900 dark:text-gray-100">m</kbd>
              </div>
            </div>
          </div>

          <!-- Article Actions -->
          <div>
            <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">Article Actions</h3>
            <div class="space-y-2">
              <div class="flex items-center justify-between py-2 border-b border-gray-200 dark:border-gray-700">
                <span class="text-gray-700 dark:text-gray-300">Open/expand selected article</span>
                <div class="flex gap-2">
                  <kbd class="px-3 py-1 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-sm font-mono text-gray-900 dark:text-gray-100">o</kbd>
                  <span class="text-gray-400 dark:text-gray-500">or</span>
                  <kbd class="px-3 py-1 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-sm font-mono text-gray-900 dark:text-gray-100">Enter</kbd>
                </div>
              </div>
              <div class="flex items-center justify-between py-2 border-b border-gray-200 dark:border-gray-700">
                <span class="text-gray-700 dark:text-gray-300">Close expanded article</span>
                <kbd class="px-3 py-1 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-sm font-mono text-gray-900 dark:text-gray-100">Esc</kbd>
              </div>
              <div class="flex items-center justify-between py-2 border-b border-gray-200 dark:border-gray-700">
                <span class="text-gray-700 dark:text-gray-300">Mark selected as read (without opening)</span>
                <kbd class="px-3 py-1 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-sm font-mono text-gray-900 dark:text-gray-100">e</kbd>
              </div>
              <div class="flex items-center justify-between py-2 border-b border-gray-200 dark:border-gray-700">
                <span class="text-gray-700 dark:text-gray-300">Mark selected as unread</span>
                <kbd class="px-3 py-1 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-sm font-mono text-gray-900 dark:text-gray-100">Shift</kbd>
                <span class="text-gray-400 dark:text-gray-500 mx-2">+</span>
                <kbd class="px-3 py-1 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-sm font-mono text-gray-900 dark:text-gray-100">u</kbd>
              </div>
              <div class="flex items-center justify-between py-2 border-b border-gray-200 dark:border-gray-700">
                <span class="text-gray-700 dark:text-gray-300">View original (open in new tab)</span>
                <kbd class="px-3 py-1 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-sm font-mono text-gray-900 dark:text-gray-100">v</kbd>
              </div>
            </div>
          </div>

          <!-- Bulk Actions -->
          <div>
            <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">Bulk Actions</h3>
            <div class="space-y-2">
              <div class="flex items-center justify-between py-2 border-b border-gray-200 dark:border-gray-700">
                <span class="text-gray-700 dark:text-gray-300">Mark all visible as read</span>
                <kbd class="px-3 py-1 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-sm font-mono text-gray-900 dark:text-gray-100">Shift</kbd>
                <span class="text-gray-400 dark:text-gray-500 mx-2">+</span>
                <kbd class="px-3 py-1 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-sm font-mono text-gray-900 dark:text-gray-100">a</kbd>
              </div>
              <div class="flex items-center justify-between py-2 border-b border-gray-200 dark:border-gray-700">
                <span class="text-gray-700 dark:text-gray-300">Refresh current feed</span>
                <kbd class="px-3 py-1 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-sm font-mono text-gray-900 dark:text-gray-100">r</kbd>
              </div>
              <div class="flex items-center justify-between py-2 border-b border-gray-200 dark:border-gray-700">
                <span class="text-gray-700 dark:text-gray-300">Refresh all feeds</span>
                <kbd class="px-3 py-1 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-sm font-mono text-gray-900 dark:text-gray-100">Shift</kbd>
                <span class="text-gray-400 dark:text-gray-500 mx-2">+</span>
                <kbd class="px-3 py-1 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-sm font-mono text-gray-900 dark:text-gray-100">r</kbd>
              </div>
            </div>
          </div>

          <!-- Help -->
          <div>
            <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">Help</h3>
            <div class="space-y-2">
              <div class="flex items-center justify-between py-2 border-b border-gray-200 dark:border-gray-700">
                <span class="text-gray-700 dark:text-gray-300">Show this help dialog</span>
                <kbd class="px-3 py-1 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-sm font-mono text-gray-900 dark:text-gray-100">?</kbd>
              </div>
            </div>
          </div>

          <!-- Footer Note -->
          <div class="pt-4 text-sm text-gray-500 dark:text-gray-400 text-center border-t border-gray-200 dark:border-gray-700">
            Press <kbd class="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-xs font-mono text-gray-900 dark:text-gray-100">Esc</kbd> or click outside to close
          </div>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
const isOpen = ref(false)

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

kbd {
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
}
</style>
