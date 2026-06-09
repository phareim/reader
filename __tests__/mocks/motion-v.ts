import { defineComponent, h } from 'vue'

const passthrough = (tag: string) =>
  defineComponent({
    inheritAttrs: false,
    setup(_, { slots, attrs }) {
      return () => h(tag, attrs, slots.default?.())
    },
  })

// Cache per key so `motion.div` keeps a stable component identity across
// renders (a fresh component each access would remount the card every render).
const motionCache: Record<string, any> = {}
export const motion = new Proxy({} as Record<string, any>, {
  get: (_t, key) => {
    const k = typeof key === 'string' ? key : 'div'
    return (motionCache[k] ??= passthrough('div'))
  },
})

export const AnimatePresence = passthrough('div')

export function useMotionValue(initial: number) {
  let v = initial
  return { get: () => v, set: (n: number) => { v = n }, on: () => () => {} }
}

export function useTransform() {
  return useMotionValue(0)
}

// ── Controllable animations ────────────────────────────────────────────
// Default: auto-resolve (existing tests). Flip __setManualAnimations(true)
// to make every animate() return a deferred, then flush them all with
// __resolveAnimations() — lets tests assert behavior mid-flight.
let manualAnimations = false
let pendingAnimations: Array<() => void> = []

export function __setManualAnimations(on: boolean) {
  manualAnimations = on
  if (!on) __resolveAnimations()
}

export function __resolveAnimations() {
  const resolvers = pendingAnimations
  pendingAnimations = []
  resolvers.forEach((resolve) => resolve())
}

export function animate(_mv: any, _target: any, _opts?: any) {
  const p = manualAnimations
    ? new Promise<void>((resolve) => pendingAnimations.push(resolve))
    : Promise.resolve()
  return Object.assign(p, { stop: () => {} })
}

export type PanInfo = {
  point: { x: number; y: number }
  delta: { x: number; y: number }
  offset: { x: number; y: number }
  velocity: { x: number; y: number }
}
