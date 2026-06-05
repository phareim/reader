<template>
  <Transition name="fade">
    <div
      v-if="modalOpen"
      class="fixed inset-0 z-50 flex items-center justify-center p-almanac-gutter font-serif text-ink"
      style="background: var(--almanac-scrim, rgba(26,26,26,0.28));"
      @click.self="closeModal"
    >
      <PaperPanel flush class="w-full max-w-4xl max-h-[90vh] flex flex-col">
        <!-- Header -->
        <div class="flex items-start justify-between px-almanac-gutter pt-almanac-gutter pb-almanac-section-gap">
          <div class="flex-1">
            <MonoLabel as="span">Newsletter</MonoLabel>
            <SerifHeadline level="h2" class="mt-1">Summary</SerifHeadline>
            <p v-if="metadata" class="text-[13px] text-mute italic mt-1">
              {{ metadata.articlesAnalyzed }} articles analyzed · Generated {{ formatDate(metadata.generatedAt) }}
            </p>
          </div>
          <button
            type="button"
            @click="closeModal"
            class="text-mute hover:text-rust transition-colors ml-4"
            aria-label="Close"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div class="px-almanac-gutter"><HeaderDivider /></div>

        <!-- Content -->
        <div class="flex-1 overflow-y-auto px-almanac-gutter py-almanac-section-gap">
          <div
            class="prose dark:prose-invert max-w-almanac-measure mx-auto font-serif newsletter-prose"
            v-html="renderedNewsletter"
          />
        </div>

        <!-- Footer -->
        <div class="px-almanac-gutter"><SectionDivider /></div>
        <div class="flex items-center justify-between px-almanac-gutter pb-almanac-gutter pt-1">
          <ActionLabel
            :label="copied ? 'COPIED' : 'COPY'"
            @click="copyToClipboard"
          />
          <ActionLabel label="CLOSE" accent @click="closeModal" />
        </div>
      </PaperPanel>
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
    return '<p class="text-rust">Error rendering newsletter content</p>'
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

/* Serif prose, rust links — the one accent. */
.newsletter-prose :deep(a) {
  color: var(--almanac-accent);
  text-decoration: underline;
  text-underline-offset: 2px;
}
.newsletter-prose :deep(a:hover) {
  opacity: 0.8;
}
</style>
