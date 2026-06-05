<template>
  <PaperPanel
    flush
    class="relative h-full w-full overflow-hidden select-none"
    :style="topCardStyle"
    v-on="isTop ? handlers : {}"
  >
    <!-- Accent edge: one leading-side rust/amber bar, revealed during drag -->
    <div
      v-if="isTop"
      class="pointer-events-none absolute inset-y-0 left-0 w-[3px]"
      :style="{ background: 'var(--almanac-accent)', opacity: edgeOpacity('left') }"
    />
    <div
      v-if="isTop"
      class="pointer-events-none absolute inset-y-0 right-0 w-[3px]"
      :style="{ background: 'var(--almanac-accent)', opacity: edgeOpacity('right') }"
    />
    <div
      v-if="isTop"
      class="pointer-events-none absolute inset-x-0 top-0 h-[3px]"
      :style="{ background: 'var(--almanac-accent)', opacity: edgeOpacity('up') }"
    />
    <div
      v-if="isTop"
      class="pointer-events-none absolute inset-x-0 bottom-0 h-[3px]"
      :style="{ background: 'var(--almanac-accent)', opacity: edgeOpacity('down') }"
    />

    <!-- Pending action label during drag -->
    <div
      v-if="isTop && pendingLabel"
      class="pointer-events-none absolute top-almanac-gutter z-10"
      :class="pendingSide === 'right' ? 'right-almanac-gutter' : 'left-almanac-gutter'"
      :style="{ opacity: pendingOpacity }"
    >
      <span class="inline-flex items-baseline border border-rust px-3 py-2">
        <MonoLabel>{{ pendingLabel }}</MonoLabel>
      </span>
    </div>

    <div class="flex h-full flex-col p-almanac-gutter">
      <MonoLabel class="block">{{ sourceLabel }}</MonoLabel>

      <SerifHeadline level="h1" class="mt-3">{{ article.title }}</SerifHeadline>

      <div v-if="imageUrl" class="mt-4 overflow-hidden border-b border-rule pb-4">
        <img
          :src="imageUrl"
          :alt="article.title"
          class="max-h-56 w-full object-cover"
          loading="lazy"
          @error="onImageError"
        />
      </div>

      <p
        v-if="excerpt"
        class="mt-4 font-serif text-[14px] leading-[1.55] text-mute"
        style="display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;"
      >
        {{ excerpt }}
      </p>

      <div class="mt-auto pt-4">
        <span class="font-serif text-[13px] italic text-mute">{{ dateLabel }}</span>
      </div>
    </div>
  </PaperPanel>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import type { Article } from '~/types'
import type { DeckDirection } from '~/utils/deck'
import { formatRelativeDate } from '~/utils/formatDate'

/**
 * ArticleStackCard — a single paper sheet in the reading deck.
 * The top card is bound to the gesture transform via `topCardStyle` and reveals
 * one accent edge + a pending ActionLabel on the leading side during drag.
 * Cards 2 & 3 are static sheets peeking below.
 */
const props = withDefaults(defineProps<{
  article: Article
  /** Only the top card receives gesture handlers + transform. */
  isTop?: boolean
  /** Gesture transform style (from useDeckGesture cardStyle), top card only. */
  topCardStyle?: Record<string, string>
  /** Gesture handlers object (from useDeckGesture handlers), top card only. */
  handlers?: Record<string, (e: PointerEvent) => void>
  /** Active drag direction (null when not dragging or ambiguous). */
  dragDirection?: DeckDirection | null
  /** 0..1 progress toward commit threshold. */
  dragProgress?: number
}>(), {
  isTop: false,
  topCardStyle: () => ({}),
  handlers: () => ({}),
  dragDirection: null,
  dragProgress: 0,
})

const imageError = ref(false)

const sourceLabel = computed(() => props.article.feedTitle || 'UNFILED')

const dateLabel = computed(() =>
  props.article.publishedAt ? formatRelativeDate(props.article.publishedAt) : ''
)

// Derive a hero image from summary/content when no explicit field exists.
const imageUrl = computed(() => {
  if (imageError.value) return null
  const haystack = `${props.article.summary || ''} ${props.article.content || ''}`
  const match = haystack.match(/<img[^>]+src=["']([^"']+)["']/i)
  return match ? match[1] : null
})

function onImageError() {
  imageError.value = true
}

// Plain-text excerpt from summary, falling back to stripped content.
const excerpt = computed(() => {
  const raw = props.article.summary || props.article.content || ''
  return raw
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
})

const LABELS: Record<DeckDirection, string> = {
  left: 'STORE',
  right: 'READ',
  up: 'OPEN',
  down: 'SKIP',
}

const pendingLabel = computed(() =>
  props.dragDirection ? LABELS[props.dragDirection] : null
)

const pendingSide = computed(() =>
  props.dragDirection === 'right' ? 'right' : 'left'
)

const pendingOpacity = computed(() =>
  props.dragDirection ? Math.min(props.dragProgress + 0.25, 1) : 0
)

function edgeOpacity(dir: DeckDirection): number {
  if (props.dragDirection !== dir) return 0
  return Math.min(props.dragProgress, 1)
}
</script>
