<template>
  <Teleport to="body">
    <div class="fixed inset-0 z-50" @click.self="emit('close')">
      <div class="absolute w-[18rem] max-w-[calc(100vw-2rem)]" :style="posStyle">
        <CardFrame class="p-4">
          <div class="flex items-center justify-between">
            <MonoLabel dash>Note</MonoLabel>
            <MonoLabel v-if="highlight.sflIdeaId" accent>In SFL</MonoLabel>
          </div>
          <HairlineRule class="mt-3 mb-3" />

          <p v-if="highlight.note" class="note-body text-body" v-html="noteHtml" />
          <p v-else class="italic text-mute">No note</p>

          <!-- Share the marked passage (quote + article link) to the public
               web-intent endpoints. Non-accent; brand glyphs render on every width. -->
          <div v-if="sourceUrl" class="mt-4 flex items-center gap-2">
            <ActionLabel aria-label="Share quote on X" @click="shareQuote('x')">
              <template #icon>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>
              </template>
              X
            </ActionLabel>
            <ActionLabel aria-label="Share quote on Threads" @click="shareQuote('threads')">
              <template #icon>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M12.186 24h-.007c-3.581-.024-6.334-1.205-8.184-3.509C2.35 18.44 1.5 15.586 1.472 12.01v-.017c.03-3.579.879-6.43 2.525-8.482C5.845 1.205 8.6.024 12.18 0h.014c2.746.02 5.043.725 6.826 2.098 1.677 1.29 2.858 3.13 3.509 5.467l-2.04.569c-1.104-3.96-3.898-5.984-8.304-6.015-2.91.022-5.11.936-6.54 2.717C4.307 6.504 3.616 8.914 3.59 12c.026 3.086.717 5.496 2.057 7.164 1.43 1.783 3.631 2.698 6.54 2.717 2.623-.02 4.358-.631 5.8-2.045 1.647-1.613 1.618-3.593 1.09-4.798-.31-.71-.873-1.3-1.634-1.75-.192 1.352-.622 2.446-1.284 3.272-.886 1.102-2.14 1.704-3.73 1.79-1.202.065-2.361-.218-3.259-.801-1.063-.689-1.685-1.74-1.752-2.964-.065-1.19.408-2.285 1.331-3.082.88-.76 2.119-1.207 3.583-1.291a13.853 13.853 0 0 1 3.02.142c-.126-.742-.375-1.332-.75-1.757-.513-.586-1.308-.883-2.359-.89h-.029c-.844 0-1.992.232-2.721 1.32L7.734 7.847c.98-1.454 2.568-2.256 4.478-2.256h.044c3.194.02 5.097 1.975 5.287 5.388.108.046.216.094.32.142 1.49.7 2.58 1.761 3.154 3.07.797 1.82.871 4.79-1.548 7.158-1.85 1.81-4.094 2.628-7.277 2.65Zm1.003-11.69c-.242 0-.487.007-.739.021-1.836.103-2.98.946-2.916 2.143.067 1.256 1.452 1.839 2.784 1.767 1.224-.065 2.818-.543 3.086-3.71a10.5 10.5 0 0 0-2.215-.221z" /></svg>
              </template>
              Threads
            </ActionLabel>
          </div>

          <div class="mt-4 flex justify-end gap-3">
            <ActionLabel @click="emit('remove')">Remove</ActionLabel>
            <ActionLabel @click="emit('close')">Close</ActionLabel>
          </div>
        </CardFrame>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { renderNoteHtml } from '~/utils/hashtags'
import { xQuoteShareUrl, threadsQuoteShareUrl } from '~/utils/share'
import type { Highlight } from '~/composables/useHighlights'

const props = defineProps<{ highlight: Highlight; x: number; y: number; sourceUrl?: string }>()
const emit = defineEmits<{ remove: []; close: [] }>()

const noteHtml = computed(() => renderNoteHtml(props.highlight.note))

function shareQuote(target: 'x' | 'threads') {
  const url = props.sourceUrl
  if (!url) return
  const quote = props.highlight.quote
  const intent = target === 'x' ? xQuoteShareUrl(quote, url) : threadsQuoteShareUrl(quote, url)
  window.open(intent, '_blank', 'noopener')
}

// Clamp the popover into the viewport near the tapped mark.
const posStyle = computed(() => {
  const margin = 16
  const width = 288 // 18rem
  const maxLeft = (typeof window !== 'undefined' ? window.innerWidth : width + 2 * margin) - width - margin
  const left = Math.max(margin, Math.min(props.x, maxLeft))
  return { left: `${left}px`, top: `${props.y + 12}px` }
})
</script>

<style scoped>
.note-body :deep(.note-tag) {
  color: var(--text-accent);
  font-style: italic;
  font-weight: 700;
}
</style>
