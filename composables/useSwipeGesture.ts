/**
 * Composable for handling horizontal swipe gestures
 * Extracted from pages/article/[id].vue for reusability
 */

import { ref, computed, onMounted, onUnmounted, type Ref } from 'vue'

// Swipe configuration constants
export const SWIPE_CONFIG = {
  MAX_DISTANCE: 200,
  MIN_DISTANCE_RATIO: 0.67, // 67% of max distance required to trigger
  MAX_VERTICAL_THRESHOLD: 50, // Max vertical movement allowed for horizontal swipe
  HORIZONTAL_DOMINANCE_RATIO: 1.5, // Horizontal movement must be 1.5x vertical
  MIN_SWIPE_DETECTION: 10 // Minimum movement to start detecting swipe
} as const

export interface UseSwipeGestureOptions {
  onSwipeLeft?: () => void
  onSwipeRight?: () => void
  canSwipeLeft: Ref<boolean>
  canSwipeRight: Ref<boolean>
  disabled?: Ref<boolean>
}

/**
 * Check if an element is interactive (should not trigger swipe)
 */
function isInteractiveElement(target: HTMLElement): boolean {
  const interactiveTags = ['INPUT', 'TEXTAREA', 'BUTTON', 'A']
  return (
    interactiveTags.includes(target.tagName) ||
    target.closest('button, a') !== null
  )
}

/**
 * Composable for handling swipe gestures with visual feedback
 */
export function useSwipeGesture(options: UseSwipeGestureOptions) {
  const { onSwipeLeft, onSwipeRight, canSwipeLeft, canSwipeRight, disabled } = options

  // Touch tracking state
  const touchStartX = ref(0)
  const touchStartY = ref(0)
  const touchCurrentX = ref(0)
  const touchCurrentY = ref(0)

  // Gesture state
  const isSwipeGesture = ref(false)
  const hasSwiped = ref(false)
  const swipeProgress = ref(0) // 0-1 progress
  const swipeDirection = ref<'left' | 'right' | null>(null)
  const swipeYPercent = ref(50) // Y position as percentage
  const windowHeight = ref(0)

  // Computed values
  const minSwipeDistance = SWIPE_CONFIG.MAX_DISTANCE * SWIPE_CONFIG.MIN_DISTANCE_RATIO
  const swipeThreshold = computed(() => SWIPE_CONFIG.MIN_DISTANCE_RATIO)

  /**
   * Reset all touch and gesture state
   */
  function resetTouchState() {
    touchStartX.value = 0
    touchStartY.value = 0
    touchCurrentX.value = 0
    touchCurrentY.value = 0
    isSwipeGesture.value = false
    hasSwiped.value = false
    swipeProgress.value = 0
    swipeDirection.value = null
  }

  /**
   * Handle touch start event
   */
  function handleTouchStart(e: TouchEvent) {
    if (disabled?.value) return

    // Ignore if touching interactive elements
    const target = e.target as HTMLElement
    if (isInteractiveElement(target)) {
      return
    }

    const touch = e.changedTouches[0]
    touchStartX.value = touch.clientX
    touchStartY.value = touch.clientY
    touchCurrentX.value = touch.clientX
    touchCurrentY.value = touch.clientY
    isSwipeGesture.value = false
    hasSwiped.value = false
    swipeProgress.value = 0
    swipeDirection.value = null
    windowHeight.value = window.innerHeight
    swipeYPercent.value = (touch.clientY / window.innerHeight) * 100
  }

  /**
   * Handle touch move event
   */
  function handleTouchMove(e: TouchEvent) {
    if (disabled?.value) return
    if (!touchStartX.value && !touchStartY.value) return

    const touch = e.changedTouches[0]
    touchCurrentX.value = touch.clientX
    touchCurrentY.value = touch.clientY

    const deltaX = touchCurrentX.value - touchStartX.value
    const deltaY = touchCurrentY.value - touchStartY.value
    const absDeltaX = Math.abs(deltaX)
    const absDeltaY = Math.abs(deltaY)

    // Detect if this is a horizontal swipe gesture
    // Must have significant horizontal movement and horizontal movement should dominate
    if (
      absDeltaX > SWIPE_CONFIG.MIN_SWIPE_DETECTION &&
      absDeltaX > absDeltaY * SWIPE_CONFIG.HORIZONTAL_DOMINANCE_RATIO &&
      absDeltaY < SWIPE_CONFIG.MAX_VERTICAL_THRESHOLD
    ) {
      if (!isSwipeGesture.value) {
        isSwipeGesture.value = true
        swipeDirection.value = deltaX < 0 ? 'left' : 'right'
      }

      // Update swipe progress (0-1)
      swipeProgress.value = Math.min(absDeltaX / SWIPE_CONFIG.MAX_DISTANCE, 1)

      // Update Y position percentage
      swipeYPercent.value = (touch.clientY / window.innerHeight) * 100

      // Prevent default scrolling when swiping horizontally
      if (isSwipeGesture.value && e.cancelable) {
        e.preventDefault()
      }
    }
  }

  /**
   * Handle touch end event
   */
  function handleTouchEnd(e: TouchEvent) {
    if (disabled?.value) return
    if (!touchStartX.value && !touchStartY.value) return

    const touch = e.changedTouches[0]
    touchCurrentX.value = touch.clientX
    touchCurrentY.value = touch.clientY

    const deltaX = touchCurrentX.value - touchStartX.value
    const deltaY = touchCurrentY.value - touchStartY.value
    const absDeltaX = Math.abs(deltaX)
    const absDeltaY = Math.abs(deltaY)

    // Only process swipe if it was identified as a horizontal gesture
    if (
      isSwipeGesture.value &&
      absDeltaX >= minSwipeDistance &&
      absDeltaY < SWIPE_CONFIG.MAX_VERTICAL_THRESHOLD
    ) {
      e.preventDefault()
      hasSwiped.value = true

      // Swipe left -> trigger left callback
      if (deltaX < 0 && canSwipeLeft.value && onSwipeLeft) {
        onSwipeLeft()
      }
      // Swipe right -> trigger right callback
      else if (deltaX > 0 && canSwipeRight.value && onSwipeRight) {
        onSwipeRight()
      }
    }

    // Reset touch state
    resetTouchState()

    // Reset swipe flag after a short delay to prevent accidental clicks
    setTimeout(() => {
      hasSwiped.value = false
    }, 100)
  }

  /**
   * Handle touch cancel event
   */
  function handleTouchCancel() {
    resetTouchState()
  }

  // Setup event listeners
  onMounted(() => {
    window.addEventListener('touchstart', handleTouchStart, { passive: true })
    window.addEventListener('touchmove', handleTouchMove, { passive: false })
    window.addEventListener('touchend', handleTouchEnd, { passive: false })
    window.addEventListener('touchcancel', handleTouchCancel)
  })

  // Cleanup event listeners
  onUnmounted(() => {
    window.removeEventListener('touchstart', handleTouchStart)
    window.removeEventListener('touchmove', handleTouchMove)
    window.removeEventListener('touchend', handleTouchEnd)
    window.removeEventListener('touchcancel', handleTouchCancel)
  })

  return {
    // Gesture state
    isSwipeGesture,
    swipeProgress,
    swipeDirection,
    swipeYPercent,
    windowHeight,
    swipeThreshold,
    hasSwiped
  }
}
