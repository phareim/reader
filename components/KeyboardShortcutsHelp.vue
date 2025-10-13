<template>
  <Transition name="fade">
    <div
      v-if="isOpen"
      class="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
      @click.self="close"
    >
      <div class="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
        <!-- Header -->
        <div class="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
          <h2 class="text-2xl font-bold text-gray-900">Keyboard Shortcuts</h2>
          <button
            @click="close"
            class="p-2 hover:bg-gray-100 rounded-lg transition-colors"
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
            <h3 class="text-lg font-semibold text-gray-900 mb-3">Navigation</h3>
            <div class="space-y-2">
              <div class="flex items-center justify-between py-2 border-b">
                <span class="text-gray-700">Next article</span>
                <div class="flex gap-2">
                  <kbd class="px-3 py-1 bg-gray-100 border border-gray-300 rounded text-sm font-mono">j</kbd>
                  <span class="text-gray-400">or</span>
                  <kbd class="px-3 py-1 bg-gray-100 border border-gray-300 rounded text-sm font-mono">↓</kbd>
                </div>
              </div>
              <div class="flex items-center justify-between py-2 border-b">
                <span class="text-gray-700">Previous article</span>
                <div class="flex gap-2">
                  <kbd class="px-3 py-1 bg-gray-100 border border-gray-300 rounded text-sm font-mono">k</kbd>
                  <span class="text-gray-400">or</span>
                  <kbd class="px-3 py-1 bg-gray-100 border border-gray-300 rounded text-sm font-mono">↑</kbd>
                </div>
              </div>
              <div class="flex items-center justify-between py-2 border-b">
                <span class="text-gray-700">Go to all feeds</span>
                <kbd class="px-3 py-1 bg-gray-100 border border-gray-300 rounded text-sm font-mono">g</kbd>
                <span class="text-gray-400 mx-2">then</span>
                <kbd class="px-3 py-1 bg-gray-100 border border-gray-300 rounded text-sm font-mono">i</kbd>
              </div>
              <div class="flex items-center justify-between py-2 border-b">
                <span class="text-gray-700">Go to all articles</span>
                <kbd class="px-3 py-1 bg-gray-100 border border-gray-300 rounded text-sm font-mono">g</kbd>
                <span class="text-gray-400 mx-2">then</span>
                <kbd class="px-3 py-1 bg-gray-100 border border-gray-300 rounded text-sm font-mono">a</kbd>
              </div>
            </div>
          </div>

          <!-- Menu & Navigation -->
          <div>
            <h3 class="text-lg font-semibold text-gray-900 mb-3">Menu</h3>
            <div class="space-y-2">
              <div class="flex items-center justify-between py-2 border-b">
                <span class="text-gray-700">Toggle menu</span>
                <kbd class="px-3 py-1 bg-gray-100 border border-gray-300 rounded text-sm font-mono">m</kbd>
              </div>
            </div>
          </div>

          <!-- Article Actions -->
          <div>
            <h3 class="text-lg font-semibold text-gray-900 mb-3">Article Actions</h3>
            <div class="space-y-2">
              <div class="flex items-center justify-between py-2 border-b">
                <span class="text-gray-700">Open/expand selected article</span>
                <div class="flex gap-2">
                  <kbd class="px-3 py-1 bg-gray-100 border border-gray-300 rounded text-sm font-mono">o</kbd>
                  <span class="text-gray-400">or</span>
                  <kbd class="px-3 py-1 bg-gray-100 border border-gray-300 rounded text-sm font-mono">Enter</kbd>
                </div>
              </div>
              <div class="flex items-center justify-between py-2 border-b">
                <span class="text-gray-700">Close expanded article</span>
                <kbd class="px-3 py-1 bg-gray-100 border border-gray-300 rounded text-sm font-mono">Esc</kbd>
              </div>
              <div class="flex items-center justify-between py-2 border-b">
                <span class="text-gray-700">Mark selected as read (without opening)</span>
                <kbd class="px-3 py-1 bg-gray-100 border border-gray-300 rounded text-sm font-mono">e</kbd>
              </div>
              <div class="flex items-center justify-between py-2 border-b">
                <span class="text-gray-700">Mark selected as unread</span>
                <kbd class="px-3 py-1 bg-gray-100 border border-gray-300 rounded text-sm font-mono">Shift</kbd>
                <span class="text-gray-400 mx-2">+</span>
                <kbd class="px-3 py-1 bg-gray-100 border border-gray-300 rounded text-sm font-mono">u</kbd>
              </div>
              <div class="flex items-center justify-between py-2 border-b">
                <span class="text-gray-700">View original (open in new tab)</span>
                <kbd class="px-3 py-1 bg-gray-100 border border-gray-300 rounded text-sm font-mono">v</kbd>
              </div>
            </div>
          </div>

          <!-- Bulk Actions -->
          <div>
            <h3 class="text-lg font-semibold text-gray-900 mb-3">Bulk Actions</h3>
            <div class="space-y-2">
              <div class="flex items-center justify-between py-2 border-b">
                <span class="text-gray-700">Mark all visible as read</span>
                <kbd class="px-3 py-1 bg-gray-100 border border-gray-300 rounded text-sm font-mono">Shift</kbd>
                <span class="text-gray-400 mx-2">+</span>
                <kbd class="px-3 py-1 bg-gray-100 border border-gray-300 rounded text-sm font-mono">a</kbd>
              </div>
              <div class="flex items-center justify-between py-2 border-b">
                <span class="text-gray-700">Refresh current feed</span>
                <kbd class="px-3 py-1 bg-gray-100 border border-gray-300 rounded text-sm font-mono">r</kbd>
              </div>
              <div class="flex items-center justify-between py-2 border-b">
                <span class="text-gray-700">Refresh all feeds</span>
                <kbd class="px-3 py-1 bg-gray-100 border border-gray-300 rounded text-sm font-mono">Shift</kbd>
                <span class="text-gray-400 mx-2">+</span>
                <kbd class="px-3 py-1 bg-gray-100 border border-gray-300 rounded text-sm font-mono">r</kbd>
              </div>
            </div>
          </div>

          <!-- Help -->
          <div>
            <h3 class="text-lg font-semibold text-gray-900 mb-3">Help</h3>
            <div class="space-y-2">
              <div class="flex items-center justify-between py-2 border-b">
                <span class="text-gray-700">Show this help dialog</span>
                <kbd class="px-3 py-1 bg-gray-100 border border-gray-300 rounded text-sm font-mono">?</kbd>
              </div>
            </div>
          </div>

          <!-- Footer Note -->
          <div class="pt-4 text-sm text-gray-500 text-center border-t">
            Press <kbd class="px-2 py-0.5 bg-gray-100 border border-gray-300 rounded text-xs font-mono">Esc</kbd> or click outside to close
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
