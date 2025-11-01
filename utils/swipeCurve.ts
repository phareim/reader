/**
 * Utilities for generating SVG paths for swipe gesture indicators
 * Extracted from pages/article/[id].vue for reusability and testability
 */

export interface Point {
  x: number
  y: number
}

export interface CurveParams {
  height: number
  yPos: number
  swipeProgress: number
  side: 'left' | 'right'
  maxWidth: number
  curveAmount: number
}

// Configuration constants
export const SVG_CONFIG = {
  BASE_WIDTH: 128,
  MAX_CURVE_EXTENSION: 300,
  CURVE_POINTS: 20,
  TENSION: 0.5
} as const

/**
 * Smoothstep easing function for smooth curve interpolation (0 to 1)
 */
export function smoothstep(t: number): number {
  return t * t * (3 - 2 * t)
}

/**
 * Generate points for the swipe curve based on touch position
 * Creates an organic bend effect centered at the touch point
 */
export function generateSwipeCurvePoints(params: CurveParams): Point[] {
  const { height, yPos, swipeProgress, side, maxWidth, curveAmount } = params
  const points: Point[] = []

  for (let i = 0; i <= SVG_CONFIG.CURVE_POINTS; i++) {
    const t = i / SVG_CONFIG.CURVE_POINTS // 0 to 1
    const y = t * height

    // Calculate distance from touch point (normalized to 0-1)
    const distanceFromPeak = Math.abs(y - yPos) / (height / 2)
    const clampedDistance = Math.min(distanceFromPeak, 1)

    // Use smoothstep for a rounded bell curve effect
    const influence = 1 - smoothstep(clampedDistance)

    // Calculate X offset based on influence (creates smooth rounded peak)
    const offset = curveAmount * influence
    const x = side === 'left' ? offset : maxWidth - offset

    points.push({ x, y })
  }

  return points
}

/**
 * Build an SVG path from points using smooth curves
 * Uses Catmull-Rom style interpolation for smooth transitions
 */
export function buildCurvePath(points: Point[], edgeX: number, closed: boolean): string {
  if (points.length < 2) {
    return `M ${edgeX},0`
  }

  let path = `M ${edgeX},0`

  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1]
    const curr = points[i]

    if (i === 1) {
      // First segment: smooth curve from edge
      const controlX = (prev.x + curr.x) / 2
      const controlY = (prev.y + curr.y) / 2
      path += ` Q ${controlX},${controlY} ${curr.x},${curr.y}`
    } else if (i === points.length - 1) {
      // Last segment: smooth curve to edge
      const controlX = (prev.x + curr.x) / 2
      const controlY = (prev.y + curr.y) / 2
      path += ` Q ${controlX},${controlY} ${curr.x},${curr.y}`
    } else {
      // Middle segments: use cubic bezier for smoother transitions
      const prevPrev = points[i - 2]
      const next = points[i + 1]

      // Calculate smooth control points using Catmull-Rom style
      const cp1X = prev.x + (curr.x - prevPrev.x) * SVG_CONFIG.TENSION
      const cp1Y = prev.y + (curr.y - prevPrev.y) * SVG_CONFIG.TENSION
      const cp2X = curr.x - (next.x - prev.x) * SVG_CONFIG.TENSION
      const cp2Y = curr.y - (next.y - prev.y) * SVG_CONFIG.TENSION

      path += ` C ${cp1X},${cp1Y} ${cp2X},${cp2Y} ${curr.x},${curr.y}`
    }
  }

  // Close the path if requested (for filled areas)
  if (closed && points.length > 0) {
    const lastPoint = points[points.length - 1]
    path += ` L ${edgeX},${lastPoint.y} Z`
  }

  return path
}

/**
 * Generate SVG path for the swipe curve stroke
 */
export function getSwipeCurve(side: 'left' | 'right', params: Omit<CurveParams, 'side'>): string {
  const fullParams: CurveParams = { ...params, side }
  const edgeX = side === 'left' ? 0 : fullParams.maxWidth
  const points = generateSwipeCurvePoints(fullParams)
  return buildCurvePath(points, edgeX, false)
}

/**
 * Generate SVG path for the filled area (closed path between edge and curve)
 */
export function getSwipeFillPath(side: 'left' | 'right', params: Omit<CurveParams, 'side'>): string {
  const fullParams: CurveParams = { ...params, side }
  const edgeX = side === 'left' ? 0 : fullParams.maxWidth
  const points = generateSwipeCurvePoints(fullParams)
  return buildCurvePath(points, edgeX, true)
}

/**
 * Helper to calculate curve parameters from swipe state
 */
export function getCurveParams(
  windowHeight: number,
  swipeYPercent: number,
  swipeProgress: number
): Omit<CurveParams, 'side'> {
  const yPos = (swipeYPercent / 100) * windowHeight
  const maxWidth = SVG_CONFIG.BASE_WIDTH + swipeProgress * SVG_CONFIG.MAX_CURVE_EXTENSION
  const curveAmount = swipeProgress * SVG_CONFIG.MAX_CURVE_EXTENSION

  return {
    height: windowHeight,
    yPos,
    swipeProgress,
    maxWidth,
    curveAmount
  }
}
