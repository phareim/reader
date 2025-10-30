<template>
  <div
    class="swipe-wrapper relative"
    :class="{ 'is-removing': isRemoving }"
  >
    <!-- Swipe Overlays -->
    <div
      v-if="allowSwipe && swipeDirection !== 'none'"
      class="swipe-overlay absolute inset-0 flex items-center justify-center pointer-events-none z-10 rounded-lg"
      :class="{
        'swipe-overlay-left': swipeDirection === 'left',
        'swipe-overlay-right': swipeDirection === 'right'
      }"
      :style="{ opacity: swipeProgress }"
    >
      <!-- Left swipe (Mark as Read) -->
      <div v-if="swipeDirection === 'left'" class="flex flex-col items-center gap-2 text-white">
        <svg class="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
        </svg>
        <span class="text-sm font-semibold">Mark as Read</span>
      </div>

      <!-- Right swipe (Save) -->
      <div v-if="swipeDirection === 'right'" class="flex flex-col items-center gap-2 text-white">
        <svg class="w-12 h-12" fill="currentColor" viewBox="0 0 24 24">
          <path d="M17 3H7c-1.1 0-2 .9-2 2v16l7-3 7 3V5c0-1.1-.9-2-2-2z"/>
        </svg>
        <span class="text-sm font-semibold">Save Article</span>
      </div>
    </div>

    <NuxtLink
      ref="cardRef"
      :to="`/article/${article.id}`"
      :id="`article-card-${article.id}`"
      :data-article-id="article.id"
      class="article-card block bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-lg transition-all group relative"
      :class="{
        'ring-2 ring-blue-500 shadow-lg translate-y-[-4px] dark:bg-zinc-800': isSelected,
        'hover:translate-y-[-2px]': !isSelected && !isDragging,
        'overflow-visible': showActionsMenu,
        'overflow-hidden': !showActionsMenu,
        'dynamic-height': dynamicHeight,
        'cursor-grab': allowSwipe && !isDragging,
        'cursor-grabbing': isDragging,
        'hover:shadow-md dark:hover:bg-zinc-800': !isDragging,
        'swipe-transition': !isDragging && !isRemoving,
        'duration-200': !isDragging && !isRemoving
      }"
      :style="{
        transform: `translateX(${swipeOffset}px)`,
        transition: isDragging ? 'none' : undefined
      }"
      @pointerdown="handlePointerDown"
      @pointermove="handlePointerMove"
      @pointerup="handlePointerUp"
      @pointercancel="handlePointerCancel"
      @touchstart="handlePointerDown"
      @touchmove="handlePointerMove"
      @touchend="handlePointerUp"
      @touchcancel="handlePointerCancel"
    >
    <!-- Flexible height container -->
    <div
      class="card-container relative w-full"
      :class="dynamicHeight ? 'min-h-0' : 'fixed-aspect'"
    >
      <!-- Image or Gradient Section -->
      <div
        v-if="displayImageUrl || showGradient"
        :class="dynamicHeight ? 'relative' : 'absolute inset-x-0 top-0'"
        class="h-40 overflow-hidden rounded-t-lg"
      >
        <!-- Actual image -->
        <img
          v-if="displayImageUrl && !imageError"
          :src="displayImageUrl"
          :alt="article.title"
          class="w-full h-full object-cover transition-transform duration-300 ease-out"
          :class="{
            'scale-110': isSelected,
            'group-hover:scale-110': !isSelected
          }"
          @error="handleImageError"
        />
        <!-- Gradient placeholder -->
        <div
          v-else-if="showGradient"
          class="w-full h-full transition-transform duration-300 ease-out"
          :class="{
            'scale-110': isSelected,
            'group-hover:scale-110': !isSelected
          }"
          :style="{ background: placeholderGradient }"
        />
      </div>

      <div
        :class="[
          dynamicHeight ? 'relative' : 'absolute inset-0',
          (displayImageUrl || showGradient) ? (dynamicHeight ? '' : 'pt-44') : ''
        ]"
        class="p-3 flex flex-col"
      >
        <!-- Header Section -->
        <div class="flex items-start justify-between gap-2 mb-2">
          <div class="flex-1 min-w-0">
            <h3
              class="font-spectral line-clamp-4 mb-1 view-transition-name:article-title"
              :class="article.isRead
                ? 'text-sm font-normal text-gray-700 dark:text-gray-300'
                : 'text-base font-bold text-gray-900 dark:text-gray-100'"
            >
              {{ article.title }}
            </h3>
            <div class="text-xs text-gray-500 dark:text-gray-400 truncate">
              <span v-if="showFeedTitle && article.feedTitle">{{ article.feedTitle }} • </span>
              {{ formatDate(article.publishedAt) }}
            </div>
          </div>

          <!-- Unread indicator and actions -->
          <div class="flex items-center gap-1 flex-shrink-0">
            <span v-if="!article.isRead" class="text-blue-500 dark:text-blue-400 text-lg leading-none">•</span>

            <!-- Actions Menu -->
            <div class="relative z-50" @click.stop.prevent>
              <button
                ref="menuButtonRef"
                @click.stop.prevent="toggleActionsMenu"
                class="p-1 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded transition-colors opacity-0 group-hover:opacity-100"
                :class="showActionsMenu ? 'opacity-100 bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-gray-300' : 'text-gray-400 dark:text-gray-500'"
                :title="'Article actions'"
              >
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"/>
                </svg>
              </button>

              <!-- Actions Dropdown -->
              <Transition name="dropdown">
                <div
                  v-if="showActionsMenu"
                  ref="actionsMenuRef"
                  @click.stop
                  class="absolute right-0 top-full mt-1 z-50"
                >
                  <ArticleActionsMenu
                    :article="article"
                    :is-saved="isSaved"
                    :all-tags-with-counts="allTagsWithCounts"
                    @toggle-save="$emit('toggle-save')"
                    @toggle-read="$emit('toggle-read')"
                    @update-tags="(savedArticleId, tags) => $emit('update-tags', savedArticleId, tags)"
                    @delete-article="$emit('delete-article')"
                  />
                </div>
              </Transition>
            </div>
          </div>
        </div>

        <!-- Summary/Preview Section -->
        <div class="flex-1 overflow-hidden">
          <p
            v-if="article.summary"
            class="text-xs text-gray-600 dark:text-gray-400 line-clamp-6"
          >
            {{ truncateSummary(article.summary, 120) }}
          </p>
          <p
            v-else
            class="text-xs text-gray-500 dark:text-gray-500 italic"
          >
            No summary
          </p>
        </div>

        <!-- Footer with saved indicator -->
        <div v-if="isSaved" class="mt-2 pt-2 border-t border-gray-200 dark:border-zinc-800">
          <div class="flex items-center gap-1 text-xs text-yellow-600 dark:text-yellow-500">
            <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
              <path d="M17 3H7c-1.1 0-2 .9-2 2v16l7-3 7 3V5c0-1.1-.9-2-2-2z"/>
            </svg>
            <span class="text-xs">Saved</span>
          </div>
        </div>
      </div>
    </div>
  </NuxtLink>
  </div>
</template>

<script setup lang="ts">
import { formatDistanceToNow } from 'date-fns'

interface Article {
  id: number
  title: string
  url: string
  author?: string
  summary?: string
  imageUrl?: string
  publishedAt?: string
  isRead: boolean
  feedTitle?: string
  savedId?: number
  tags?: string[]
}

interface Props {
  article: Article
  isSelected: boolean
  isSaved: boolean
  showFeedTitle?: boolean
  dynamicHeight?: boolean
  allowSwipe?: boolean
  allTagsWithCounts?: Array<{ name: string; feedCount: number; savedArticleCount: number }>
}

const props = withDefaults(defineProps<Props>(), {
  showFeedTitle: false,
  dynamicHeight: false,
  allowSwipe: true,
  allTagsWithCounts: () => []
})

const emit = defineEmits<{
  'toggle-save': []
  'toggle-read': []
  'update-tags': [savedArticleId: number, tags: string[]]
  'delete-article': []
  'swipe-dismiss': []
}>()

const showActionsMenu = ref(false)
const actionsMenuRef = ref<HTMLElement | null>(null)
const menuButtonRef = ref<HTMLElement | null>(null)
const imageError = ref(false)
const runtimeImageUrl = ref<string | null>(null)
const useGradient = ref(false)

// Swipe state
const cardRef = ref<HTMLElement | null>(null)
const isDragging = ref(false)
const startX = ref(0)
const currentX = ref(0)
const swipeOffset = ref(0)
const isRemoving = ref(false)

const handleImageError = () => {
  imageError.value = true
  useGradient.value = true
}

// Generate a deterministic gradient based on article ID
const generateGradient = (id: number): string => {
  // Use article ID as seed for consistent colors
  const hue1 = (id * 137.508) % 360 // Golden angle for good distribution
  const hue2 = (hue1 + 60 + (id % 120)) % 360 // Related hue
  const saturation = 60 + (id % 20)
  const lightness = 55 + (id % 15)

  return `linear-gradient(135deg,
    hsl(${hue1}, ${saturation}%, ${lightness}%),
    hsl(${hue2}, ${saturation}%, ${lightness + 10}%))`
}

const placeholderGradient = computed(() => generateGradient(props.article.id))

// Display logic: article image > unsplash image > gradient
const displayImageUrl = computed(() => {
  if (props.article.imageUrl) {
    return props.article.imageUrl
  }
  if (runtimeImageUrl.value && !imageError.value) {
    return runtimeImageUrl.value
  }
  return null
})

const showGradient = computed(() => {
  return !props.article.imageUrl && !displayImageUrl.value
})

// Randomly fetch Unsplash image (1 in 10-20 articles)
onMounted(async () => {
  if (!props.article.imageUrl) {
    const randomChance = Math.random()
    const shouldTryUnsplash = randomChance < 0.08 // ~1 in 12-13 articles

    if (shouldTryUnsplash) {
      try {
        const response = await $fetch<{ imageUrl: string | null }>('/api/unsplash/random')
        if (response.imageUrl) {
          runtimeImageUrl.value = response.imageUrl
        } else {
          useGradient.value = true
        }
      } catch (error) {
        // Silently fall back to gradient
        useGradient.value = true
      }
    } else {
      useGradient.value = true
    }
  }
})

// Close dropdown when clicking outside
onMounted(() => {
  const handleClickOutside = (event: MouseEvent) => {
    if (!showActionsMenu.value) return

    const target = event.target as HTMLElement

    // Check if click is outside both the menu and the toggle button
    const isOutsideMenu = actionsMenuRef.value && !actionsMenuRef.value.contains(target)
    const isOutsideButton = menuButtonRef.value && !menuButtonRef.value.contains(target)

    if (isOutsideMenu && isOutsideButton) {
      showActionsMenu.value = false
    }
  }

  document.addEventListener('mousedown', handleClickOutside)

  onUnmounted(() => {
    document.removeEventListener('mousedown', handleClickOutside)
  })
})

const toggleActionsMenu = () => {
  showActionsMenu.value = !showActionsMenu.value
}

const formatDate = (date?: string) => {
  if (!date) return 'Unknown date'
  try {
    return formatDistanceToNow(new Date(date), { addSuffix: true })
  } catch {
    return 'Unknown date'
  }
}

const truncateSummary = (summary: string, maxChars = 200) => {
  if (summary.length <= maxChars) return summary
  return summary.substring(0, maxChars).trim() + '...'
}

// Swipe functionality
const swipeDirection = computed(() => {
  if (swipeOffset.value > 20) return 'right' // Save
  if (swipeOffset.value < -20) return 'left' // Mark as read
  return 'none'
})

const swipeProgress = computed(() => {
  const cardWidth = cardRef.value?.offsetWidth || 300
  return Math.min(Math.abs(swipeOffset.value) / (cardWidth * 0.9), 1)
})

const handlePointerDown = (e: PointerEvent | TouchEvent) => {
  if (!props.allowSwipe || isRemoving.value) return

  // Don't interfere with menu button clicks or text selection
  const target = e.target as HTMLElement
  if (target.closest('button') || target.closest('a')) return

  isDragging.value = true
  const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
  startX.value = clientX
  currentX.value = clientX

  // Add pointer capture for mouse events
  if ('setPointerCapture' in e && e.pointerId !== undefined) {
    const element = e.currentTarget as HTMLElement
    element.setPointerCapture(e.pointerId)
  }
}

const handlePointerMove = (e: PointerEvent | TouchEvent) => {
  if (!isDragging.value || !props.allowSwipe) return

  e.preventDefault()
  const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
  currentX.value = clientX
  swipeOffset.value = currentX.value - startX.value
}

const handlePointerUp = async () => {
  if (!isDragging.value || !props.allowSwipe) return

  isDragging.value = false
  const cardWidth = cardRef.value?.offsetWidth || 300
  const threshold = cardWidth * 0.9

  // Check if swipe threshold is met
  if (Math.abs(swipeOffset.value) >= threshold) {
    isRemoving.value = true

    // Animate card off screen
    const direction = swipeOffset.value > 0 ? 1 : -1
    swipeOffset.value = direction * (cardWidth + 50)

    // Wait for animation, then emit events
    await new Promise(resolve => setTimeout(resolve, 300))

    if (direction > 0) {
      // Right swipe - Save
      emit('toggle-save')
    } else {
      // Left swipe - Mark as read
      emit('toggle-read')
    }

    // Emit dismiss event for parent to remove from DOM
    emit('swipe-dismiss')
  } else {
    // Snap back
    swipeOffset.value = 0
  }
}

const handlePointerCancel = () => {
  isDragging.value = false
  swipeOffset.value = 0
}
</script>

<style scoped>
/* Swipe container */
.swipe-wrapper {
  transition: all 0.3s ease;
}

.swipe-wrapper.is-removing {
  opacity: 0;
  transform: scale(0.95);
}

/* Swipe overlays */
.swipe-overlay {
  transition: opacity 0.2s ease;
}

.swipe-overlay-left {
  background: linear-gradient(to right, rgba(239, 68, 68, 0.9), rgba(239, 68, 68, 0.8));
}

.swipe-overlay-right {
  background: linear-gradient(to left, rgba(234, 179, 8, 0.9), rgba(234, 179, 8, 0.8));
}

/* Smooth transition for snap back */
.swipe-transition {
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

/* Prevent text selection while dragging */
.cursor-grabbing * {
  user-select: none;
  -webkit-user-select: none;
}

/* Line clamp utilities */
.line-clamp-4 {
  display: -webkit-box;
  -webkit-line-clamp: 4;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.line-clamp-6 {
  display: -webkit-box;
  -webkit-line-clamp: 6;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* Fixed aspect ratio for multi-column layouts */
.card-container.fixed-aspect {
  aspect-ratio: 3/4;
}

/* Automatic dynamic height in single-column layouts (mobile) */
@media (max-width: 639px) {
  /* Override the fixed aspect ratio on mobile */
  .card-container.fixed-aspect {
    aspect-ratio: auto;
  }

  /* Make the image and content flow naturally on mobile */
  .card-container.fixed-aspect > div {
    position: relative !important;
    inset: auto !important;
  }

  /* Remove top padding since content flows naturally */
  .card-container.fixed-aspect > div.pt-44 {
    padding-top: 0.75rem !important;
  }
}

/* Dropdown transition */
.dropdown-enter-active,
.dropdown-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.dropdown-enter-from,
.dropdown-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

.dropdown-enter-to,
.dropdown-leave-from {
  opacity: 1;
  transform: translateY(0);
}
</style>
