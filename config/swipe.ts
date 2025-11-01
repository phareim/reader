/**
 * Centralized configuration for swipe gesture system
 * These constants control the behavior and appearance of swipe navigation
 */

/**
 * Configuration for swipe gesture detection and behavior
 */
export const SWIPE_GESTURE_CONFIG = {
  /** Maximum swipe distance for 100% progress */
  MAX_DISTANCE: 200,

  /** Minimum distance ratio required to trigger navigation (0.67 = 67% of max) */
  MIN_DISTANCE_RATIO: 0.67,

  /** Maximum vertical movement allowed for horizontal swipe detection */
  MAX_VERTICAL_THRESHOLD: 50,

  /** Horizontal movement must be this many times larger than vertical */
  HORIZONTAL_DOMINANCE_RATIO: 1.5,

  /** Minimum movement in pixels to start detecting a swipe */
  MIN_SWIPE_DETECTION: 10
} as const

/**
 * Configuration for SVG path generation and rendering
 */
export const SWIPE_SVG_CONFIG = {
  /** Base width of swipe indicator at 0% progress */
  BASE_WIDTH: 128,

  /** Maximum curve extension into page (at 100% progress) */
  MAX_CURVE_EXTENSION: 300,

  /** Number of points used to generate smooth curve */
  CURVE_POINTS: 20,

  /** Tension for Catmull-Rom interpolation (0-1, lower = smoother) */
  TENSION: 0.5
} as const

/**
 * Configuration for swipe visual feedback
 */
export const SWIPE_VISUAL_CONFIG = {
  /** Gaussian blur amount for glow effect */
  GLOW_BLUR: 16,

  /** Base opacity for gradient at edges */
  GRADIENT_BASE_OPACITY: 0.08,

  /** Opacity multiplier based on progress */
  GRADIENT_PROGRESS_MULTIPLIER: 0.06,

  /** Peak opacity for gradient at touch point */
  GRADIENT_PEAK_OPACITY: 0.18,

  /** Peak opacity multiplier based on progress */
  GRADIENT_PEAK_MULTIPLIER: 0.12,

  /** Fill opacity when threshold is passed */
  FILL_BASE_OPACITY: 0.08,

  /** Fill opacity multiplier after threshold */
  FILL_THRESHOLD_MULTIPLIER: 0.07,

  /** Icon size (width and height in pixels) */
  ICON_SIZE: 64,

  /** Icon horizontal offset from edge */
  ICON_OFFSET_BASE: 16,

  /** Icon horizontal offset multiplier by progress */
  ICON_OFFSET_MULTIPLIER: 150
} as const

/**
 * Helper to calculate derived values from config
 */
export const SwipeHelpers = {
  /** Get minimum swipe distance in pixels */
  getMinSwipeDistance: () =>
    SWIPE_GESTURE_CONFIG.MAX_DISTANCE * SWIPE_GESTURE_CONFIG.MIN_DISTANCE_RATIO,

  /** Get swipe threshold as a ratio (0-1) */
  getSwipeThreshold: () =>
    SWIPE_GESTURE_CONFIG.MIN_DISTANCE_RATIO,

  /** Get maximum indicator width at full progress */
  getMaxIndicatorWidth: () =>
    SWIPE_SVG_CONFIG.BASE_WIDTH + SWIPE_SVG_CONFIG.MAX_CURVE_EXTENSION,

  /** Calculate indicator width for given progress (0-1) */
  getIndicatorWidth: (progress: number) =>
    SWIPE_SVG_CONFIG.BASE_WIDTH + progress * SWIPE_SVG_CONFIG.MAX_CURVE_EXTENSION
} as const
