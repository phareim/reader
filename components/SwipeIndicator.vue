<template>
  <div
    v-if="showIndicator"
    class="absolute top-0 bottom-0"
    :class="side === 'left' ? 'left-0' : 'right-0'"
    :style="{ width: `${width}px` }"
  >
    <svg
      class="absolute inset-0 w-full h-full"
      :viewBox="`0 0 ${width} ${height}`"
      preserveAspectRatio="none"
    >
      <defs>
        <!-- Glow filter for diffuse light effect -->
        <filter :id="filterId" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="16" result="coloredBlur"/>
          <feMerge>
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>

        <!-- Gradient for the stroke -->
        <linearGradient :id="gradientId" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" :stop-color="getGradientColor(0.08, 0.06)" />
          <stop :offset="`${yPercent}%`" :stop-color="getGradientColor(0.18, 0.12)" />
          <stop offset="100%" :stop-color="getGradientColor(0.08, 0.06)" />
        </linearGradient>
      </defs>

      <!-- Filled area when threshold is passed -->
      <path
        v-if="progress >= threshold"
        :d="fillPath"
        fill="currentColor"
        class="text-blue-500 dark:text-blue-400"
        :opacity="0.08 + (progress - threshold) * 0.07"
      />

      <!-- Outer glow layer - very diffuse -->
      <path
        :d="curvePath"
        fill="none"
        :stroke="`url(#${gradientId})`"
        stroke-width="16"
        stroke-linecap="round"
        opacity="0.15"
        :filter="`url(#${filterId})`"
      />

      <!-- Middle glow layer -->
      <path
        :d="curvePath"
        fill="none"
        :stroke="`url(#${gradientId})`"
        stroke-width="12"
        stroke-linecap="round"
        opacity="0.2"
        :filter="`url(#${filterId})`"
      />

      <!-- Inner core - very subtle -->
      <path
        :d="curvePath"
        fill="none"
        :stroke="`url(#${gradientId})`"
        stroke-width="6"
        stroke-linecap="round"
        opacity="0.25"
      />
    </svg>

    <!-- Icon with transition -->
    <Transition
      enter-active-class="transition-all duration-150"
      leave-active-class="transition-all duration-150"
      enter-from-class="opacity-0 scale-75"
      enter-to-class="opacity-100 scale-100"
      leave-from-class="opacity-100 scale-100"
      leave-to-class="opacity-0 scale-75"
    >
      <div
        v-if="progress >= threshold"
        class="absolute flex items-center justify-center rounded-full bg-blue-500/20 dark:bg-blue-400/20 backdrop-blur-sm"
        :style="iconStyle"
      >
        <svg
          class="w-10 h-10 text-blue-500 dark:text-blue-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            :d="iconPath"
          />
        </svg>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { SVG_CONFIG } from '~/utils/swipeCurve'

interface Props {
  side: 'left' | 'right'
  progress: number
  yPercent: number
  height: number
  threshold: number
  curvePath: string
  fillPath: string
  canNavigate: boolean
}

const props = defineProps<Props>()

// Only show indicator if navigation is possible and swipe is in progress
const showIndicator = computed(() => props.canNavigate && props.progress > 0)

// Calculate total width including curve extension
const width = computed(() => SVG_CONFIG.BASE_WIDTH + props.progress * SVG_CONFIG.MAX_CURVE_EXTENSION)

// Unique IDs for SVG filters and gradients (avoid conflicts with multiple indicators)
const filterId = computed(() => `glow-filter-${props.side}`)
const gradientId = computed(() => `stroke-gradient-${props.side}`)

// Icon path based on side
const iconPath = computed(() =>
  props.side === 'left'
    ? 'M15 19l-7-7 7-7'  // Previous arrow (pointing left)
    : 'M9 5l7 7-7 7'     // Next arrow (pointing right)
)

// Icon positioning
const iconStyle = computed(() => ({
  top: `${props.yPercent}%`,
  [props.side]: `${16 + props.progress * 150}px`,
  transform: 'translateY(-50%)',
  width: '64px',
  height: '64px'
}))

/**
 * Calculate gradient color with opacity based on progress
 */
function getGradientColor(base: number, progressMultiplier: number): string {
  return `rgba(59, 130, 246, ${base + props.progress * progressMultiplier})`
}
</script>
