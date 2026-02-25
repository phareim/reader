<template>
  <Transition name="fade">
    <div
      v-if="modalOpen"
      class="fixed inset-0 bg-black bg-opacity-50 dark:bg-opacity-70 z-50 flex items-center justify-center p-4"
      @click.self="closeModal"
    >
      <div class="bg-white dark:bg-zinc-900 rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col">
        <!-- Header -->
        <div class="flex items-center justify-between p-6 border-b border-gray-200 dark:border-zinc-800">
          <div class="flex-1">
            <h2 class="text-2xl font-bold text-gray-900 dark:text-gray-100">
              📰 Newsletter Summary
            </h2>
            <p v-if="metadata" class="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {{ metadata.articlesAnalyzed }} articles analyzed • Generated {{ formatDate(metadata.generatedAt) }}
            </p>
          </div>
          <button
            @click="closeModal"
            class="p-2 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg transition-colors ml-4"
            aria-label="Close"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <!-- Content -->
        <div class="flex-1 overflow-y-auto p-6">
          <div
            class="prose prose-lg dark:prose-invert max-w-none"
            v-html="renderedNewsletter"
          />
        </div>

        <!-- Footer with actions -->
        <div class="flex items-center justify-between p-6 border-t border-gray-200 dark:border-zinc-800">
          <div class="flex gap-3">
            <button
              @click="copyToClipboard"
              class="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 rounded-lg transition-colors"
            >
              <svg v-if="!copied" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              <svg v-else class="w-4 h-4 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
              </svg>
              {{ copied ? 'Copied!' : 'Copy to Clipboard' }}
            </button>
          </div>
          <button
            @click="closeModal"
            class="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { marked } from 'marked'
import DOMPurify from 'isomorphic-dompurify'

const { modalOpen, newsletter, metadata, closeModal } = useSummarize()
const copied = ref(false)

const renderedNewsletter = computed(() => {
  if (!newsletter.value) return ''

  try {
    // Configure marked for safe rendering with GitHub Flavored Markdown
    const html = marked.parse(newsletter.value, {
      breaks: true,
      gfm: true
    })

    // Sanitize HTML to prevent XSS
    return DOMPurify.sanitize(html as string, {
      ADD_ATTR: ['target', 'rel'],  // Allow target="_blank" for links
      ADD_TAGS: ['iframe']  // If needed for embeds
    })
  } catch (error) {
    console.error('Error rendering newsletter:', error)
    return '<p class="text-red-600">Error rendering newsletter content</p>'
  }
})

const copyToClipboard = async () => {
  try {
    await navigator.clipboard.writeText(newsletter.value)
    copied.value = true
    setTimeout(() => {
      copied.value = false
    }, 2000)
  } catch (error) {
    console.error('Failed to copy to clipboard:', error)
  }
}

const formatDate = (dateStr: string) => {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

// Close on Escape key
onMounted(() => {
  const handleEscape = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && modalOpen.value) {
      closeModal()
    }
  }
  document.addEventListener('keydown', handleEscape)
  onUnmounted(() => {
    document.removeEventListener('keydown', handleEscape)
  })
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

/* Ensure links in the newsletter open in new tab */
:deep(a) {
  color: #3b82f6;
  text-decoration: underline;
}

:deep(a):hover {
  color: #2563eb;
}

.dark :deep(a) {
  color: #60a5fa;
}

.dark :deep(a):hover {
  color: #93c5fd;
}
</style>
