import {
  smoothstep,
  getCurveParams,
  SVG_CONFIG,
  generateSwipeCurvePoints,
} from '~/utils/swipeCurve'

describe('swipeCurve utilities', () => {
  describe('smoothstep', () => {
    it('should return 0 for input 0', () => {
      expect(smoothstep(0)).toBe(0)
    })

    it('should return 1 for input 1', () => {
      expect(smoothstep(1)).toBe(1)
    })

    it('should return 0.5 for input 0.5', () => {
      expect(smoothstep(0.5)).toBe(0.5)
    })

    it('should produce a smooth curve between 0 and 1', () => {
      // Test that the function produces expected interpolation
      const result = smoothstep(0.3)
      expect(result).toBeGreaterThan(0)
      expect(result).toBeLessThan(1)
      expect(result).toBeCloseTo(0.216, 3)
    })
  })

  describe('getCurveParams', () => {
    it('should calculate curve parameters correctly', () => {
      const windowHeight = 800
      const swipeYPercent = 50
      const swipeProgress = 0.5

      const result = getCurveParams(windowHeight, swipeYPercent, swipeProgress)

      expect(result.height).toBe(800)
      expect(result.yPos).toBe(400) // 50% of 800
      expect(result.swipeProgress).toBe(0.5)
      expect(result.maxWidth).toBe(SVG_CONFIG.BASE_WIDTH + 0.5 * SVG_CONFIG.MAX_CURVE_EXTENSION)
      expect(result.curveAmount).toBe(0.5 * SVG_CONFIG.MAX_CURVE_EXTENSION)
    })

    it('should handle edge case with 0 swipe progress', () => {
      const result = getCurveParams(1000, 25, 0)

      expect(result.yPos).toBe(250) // 25% of 1000
      expect(result.maxWidth).toBe(SVG_CONFIG.BASE_WIDTH)
      expect(result.curveAmount).toBe(0)
    })

    it('should handle edge case with 100% swipe progress', () => {
      const result = getCurveParams(600, 75, 1)

      expect(result.yPos).toBe(450) // 75% of 600
      expect(result.maxWidth).toBe(SVG_CONFIG.BASE_WIDTH + SVG_CONFIG.MAX_CURVE_EXTENSION)
      expect(result.curveAmount).toBe(SVG_CONFIG.MAX_CURVE_EXTENSION)
    })
  })

  describe('generateSwipeCurvePoints', () => {
    it('should generate correct number of points', () => {
      const params = {
        height: 800,
        yPos: 400,
        swipeProgress: 0.5,
        side: 'left' as const,
        maxWidth: 200,
        curveAmount: 150,
      }

      const points = generateSwipeCurvePoints(params)

      expect(points).toHaveLength(SVG_CONFIG.CURVE_POINTS + 1)
    })

    it('should generate points with correct y-axis distribution', () => {
      const params = {
        height: 1000,
        yPos: 500,
        swipeProgress: 0.5,
        side: 'left' as const,
        maxWidth: 200,
        curveAmount: 150,
      }

      const points = generateSwipeCurvePoints(params)

      // First point should be at y=0
      expect(points[0].y).toBe(0)
      // Last point should be at y=height
      expect(points[points.length - 1].y).toBe(1000)
    })

    it('should position left-side points correctly', () => {
      const params = {
        height: 800,
        yPos: 400,
        swipeProgress: 0.5,
        side: 'left' as const,
        maxWidth: 200,
        curveAmount: 150,
      }

      const points = generateSwipeCurvePoints(params)

      // Left side points should have x >= 0
      points.forEach(point => {
        expect(point.x).toBeGreaterThanOrEqual(0)
      })
    })

    it('should position right-side points correctly', () => {
      const params = {
        height: 800,
        yPos: 400,
        swipeProgress: 0.5,
        side: 'right' as const,
        maxWidth: 200,
        curveAmount: 150,
      }

      const points = generateSwipeCurvePoints(params)

      // Right side points should have x <= maxWidth
      points.forEach(point => {
        expect(point.x).toBeLessThanOrEqual(200)
      })
    })
  })
})
