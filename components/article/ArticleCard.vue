<template>
  <div
    ref="cardRef"
    class="swipe-wrapper relative"
    :class="{ 'is-removing': isRemoving }"
    @pointerdown="handlePointerDown"
    @pointermove="handlePointerMove"
    @pointerup="handlePointerUp"
    @pointercancel="handlePointerCancel"
  >
    <!-- Swipe action hint (accent edge label) -->
    <div
      v-if="allowSwipe && swipeDirection !== 'none'"
      class="swipe-hint absolute inset-y-0 flex items-center pointer-events-none z-10"
      :class="swipeDirection === 'left' ? 'right-0 pr-4 justify-end' : 'left-0 pl-4 justify-start'"
      :style="{ opacity: swipeProgress }"
    >
      <span class="mono-label text-rust">{{ swipeDirection === 'left' ? 'READ' : 'STORE' }}</span>
    </div>

    <article
      :id="`article-card-${article.id}`"
      :data-article-id="article.id"
      class="article-card block relative cursor-pointer py-almanac-section-gap group transition-colors"
      :class="{
        'cursor-grab': allowSwipe && !isDragging && !selectionMode,
        'cursor-grabbing': isDragging,
        'cursor-pointer': selectionMode,
        'swipe-transition': !isDragging && !isRemoving,
      }"
      :style="{
        transform: `translateX(${swipeOffset}px)`,
        transition: isDragging ? 'none' : undefined
      }"
      @click="handleCardClick"
    >
      <div class="flex items-start gap-3">
        <!-- Selection Checkbox (hairline square) -->
        <button
          v-if="selectionMode"
          type="button"
          class="mt-1 w-5 h-5 border border-rule flex items-center justify-center flex-shrink-0 transition-colors"
          :class="isSelectedForBulk ? 'border-rust text-rust' : 'text-transparent hover:border-ink/40'"
          @click.stop="(e) => emit('toggle-selection', (e as MouseEvent).shiftKey)"
          :aria-pressed="isSelectedForBulk"
        >
          <span v-if="isSelectedForBulk" class="mono-label text-rust" style="--tw-content:'';">&#10003;</span>
        </button>

        <div class="flex-1 min-w-0">
          <!-- Source / meta line -->
          <div class="flex items-baseline gap-2 mb-1.5">
            <MonoLabel v-if="showFeedTitle && article.feedTitle">{{ article.feedTitle }}</MonoLabel>
            <span class="text-[12px] text-mute font-serif">{{ formatDate(article.publishedAt) }}</span>
            <span
              v-if="!article.isRead"
              class="ml-auto mono-label text-rust"
              aria-label="Unread"
            >NEW</span>
          </div>

          <!-- Title -->
          <SerifHeadline
            level="h3"
            class="mb-1.5 transition-colors"
            :class="[
              article.isRead ? 'text-mute' : 'text-ink',
              'group-hover:text-rust',
              (isSelected || (selectionMode && isSelectedForBulk)) ? 'text-rust' : ''
            ]"
          >
            {{ article.title }}
          </SerifHeadline>

          <!-- Excerpt -->
          <p
            v-if="article.summary"
            class="font-serif text-[14px] leading-[1.55] text-mute clamp-2 max-w-almanac-measure"
          >
            {{ truncateSummary(article.summary, 220) }}
          </p>

          <!-- Saved indicator + actions row -->
          <div class="flex items-center gap-3 mt-2">
            <span v-if="isSaved" class="mono-label text-rust">STORED</span>

            <!-- Actions Menu -->
            <div class="relative ml-auto z-40" @click.stop.prevent>
              <button
                ref="menuButtonRef"
                @click.stop.prevent="toggleActionsMenu"
                class="mono-label text-mute hover:text-rust transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                :class="showActionsMenu ? 'opacity-100 text-rust' : ''"
                title="Article actions"
              >MORE</button>

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
      </div>
    </article>
  </div>
</template>

<script setup lang="ts">
import { formatRelativeDate } from '~/utils/formatDate'

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
  selectionMode?: boolean
  isSelectedForBulk?: boolean
  sourceContext?: string // e.g., "feed/123" or "tag/technology" for back navigation
}

const props = withDefaults(defineProps<Props>(), {
  showFeedTitle: false,
  dynamicHeight: false,
  allowSwipe: true,
  allTagsWithCounts: () => [],
  selectionMode: false,
  isSelectedForBulk: false
})

const emit = defineEmits<{
  'toggle-save': []
  'toggle-read': []
  'update-tags': [savedArticleId: number, tags: string[]]
  'delete-article': []
  'swipe-dismiss': []
  'toggle-selection': [shiftKey: boolean]
}>()

const showActionsMenu = ref(false)
const actionsMenuRef = ref<HTMLElement | null>(null)
const menuButtonRef = ref<HTMLElement | null>(null)

// Swipe state
const cardRef = ref<HTMLElement | null>(null)
const isDragging = ref(false)
const startX = ref(0)
const startY = ref(0)
const currentX = ref(0)
const swipeOffset = ref(0)
const isRemoving = ref(false)
const hasMoved = ref(false)
const willTriggerSwipe = ref(false)

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

const formatDate = formatRelativeDate

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
  // Use 30% threshold for desktop (easier to trigger), 50% for touch
  const thresholdPercent = window.matchMedia('(pointer: fine)').matches ? 0.3 : 0.5
  return Math.min(Math.abs(swipeOffset.value) / (cardWidth * thresholdPercent), 1)
})

const handlePointerDown = (e: PointerEvent | TouchEvent) => {
  if (!props.allowSwipe || isRemoving.value) return

  // Don't interfere with menu button clicks
  const target = e.target as HTMLElement
  if (target.closest('button') || target.closest('a')) return

  // Prevent default to avoid text selection on desktop
  if ('pointerType' in e && e.pointerType === 'mouse') {
    e.preventDefault()
  }

  isDragging.value = true
  hasMoved.value = false
  const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
  const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY
  startX.value = clientX
  startY.value = clientY
  currentX.value = clientX

  // Add pointer capture for mouse events
  if ('setPointerCapture' in e && e.pointerId !== undefined) {
    const element = e.currentTarget as HTMLElement
    element.setPointerCapture(e.pointerId)
  }
}

const handlePointerMove = (e: PointerEvent | TouchEvent) => {
  if (!isDragging.value || !props.allowSwipe) return

  const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
  const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY

  const deltaX = Math.abs(clientX - startX.value)
  const deltaY = Math.abs(clientY - startY.value)

  // Reduce threshold for desktop mouse (2px vs 5px for touch)
  const threshold = 'pointerType' in e && e.pointerType === 'mouse' ? 2 : 5

  // Only start swiping if horizontal movement is greater than vertical
  if (deltaX > threshold && deltaX > deltaY) {
    hasMoved.value = true

    // Prevent default to stop scrolling when swiping horizontally
    if (e.cancelable) {
      e.preventDefault()
    }

    currentX.value = clientX
    swipeOffset.value = currentX.value - startX.value
  }
}

const handlePointerUp = async () => {
  if (!isDragging.value || !props.allowSwipe) return

  const cardWidth = cardRef.value?.offsetWidth || 300
  // Use 30% threshold for desktop (easier to trigger), 50% for touch
  const thresholdPercent = window.matchMedia('(pointer: fine)').matches ? 0.3 : 0.5
  const threshold = cardWidth * thresholdPercent
  const didMove = hasMoved.value

  isDragging.value = false

  // Check if swipe threshold is met
  if (didMove && Math.abs(swipeOffset.value) >= threshold) {
    // Set this synchronously BEFORE any async operations
    // This prevents click navigation on desktop
    willTriggerSwipe.value = true
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

    // Reset flag after action completes
    willTriggerSwipe.value = false
  } else {
    // Snap back
    swipeOffset.value = 0

    // Keep hasMoved flag for a short time to prevent click navigation
    if (didMove) {
      setTimeout(() => {
        hasMoved.value = false
      }, 100)
    }
  }
}

const handlePointerCancel = () => {
  isDragging.value = false
  swipeOffset.value = 0
  hasMoved.value = false
  willTriggerSwipe.value = false
}

// Handle click - navigate only if not swiping/dragging
const handleCardClick = (e: MouseEvent) => {
  // In selection mode, clicking anywhere toggles selection
  if (props.selectionMode) {
    emit('toggle-selection', e.shiftKey)
    return
  }

  // Prevent navigation if user was dragging or card is being removed
  if (hasMoved.value || isDragging.value || isRemoving.value || willTriggerSwipe.value) {
    // Don't navigate, just clean up
    if (!isRemoving.value && !willTriggerSwipe.value) {
      hasMoved.value = false
    }
    return
  }

  // Otherwise, manually navigate
  const query = props.sourceContext ? { from: props.sourceContext } : {}
  navigateTo({ path: `/article/${props.article.id}`, query })
}
</script>

<style scoped>
/* Swipe container */
.swipe-wrapper {
  user-select: none;
  -webkit-user-select: none;
  touch-action: pan-y;
}

.swipe-wrapper.is-removing {
  opacity: 0;
}

.swipe-hint {
  transition: opacity 0.2s ease;
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

/* Two-line clamp for excerpt */
.clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
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
